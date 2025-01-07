import { Client, GatewayIntentBits } from 'discord.js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';

dotenv.config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const BOT_DISCORD_TOKEN = process.env.BOT_DISCORD_TOKEN;
const TRELLO_API_KEY = process.env.TRELLO_API_KEY;
const TRELLO_TOKEN = process.env.TRELLO_TOKEN;
const TRELLO_BOARD_ID = process.env.TRELLO_BOARD_ID;
const TRELLO_BASE_URL = process.env.TRELLO_BASE_URL
const HIGH_PRIORITY_LABEL_ID = process.env.HIGH_PRIORITY_LABEL_ID;
const MEDIUM_PRIORITY_LABEL_ID = process.env.MEDIUM_PRIORITY_LABEL_ID;
const LOW_PRIORITY_LABEL_ID = process.env.LOW_PRIORITY_LABEL_ID;

const app = express();
app.use(bodyParser.json());

app.post('/trello-webhook', async (req, res) => {
  const action = req.body.action;

  if (action.type === 'updateCard' && action.data.listBefore && action.data.listAfter) {
    const cardName = action.data.card.name;
    const listBefore = action.data.listBefore.name;
    const listAfter = action.data.listAfter.name;
    const cardId = action.data.card.id;
    const responseCard = await fetch(`${TRELLO_BASE_URL}/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);
    const card = await responseCard.json();

    const regexAuthorId = /ID do Autor:\s*(\d+)/;
    const authorIdMatch = card.desc.match(regexAuthorId);
    const authorId = authorIdMatch ? authorIdMatch[1] : null;

    if (listAfter === TRELLO_LIST_NAME_TO_WATCH) {
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);

      if (channel) {
        channel.send(`<@${authorId}>\n\nO card "${cardName}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
        console.log(`Mensagem enviada para o Discord: O card "${cardName}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
      } else {
        console.error('Canal do Discord não encontrado!');
      }
    }
  }
  res.status(200).send('OK');
});

app.head('/trello-webhook', (req, res) => {
  res.status(200).send();
});

const PORT = process.env.PORT || 3000;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TRELLO_LIST_NAME_TO_WATCH = 'DONE';

app.listen(PORT, () => {
  console.log(`Servidor webhook rodando na porta ${PORT}`);
});

client.once('ready', () => {
  console.log(`Task Bot está online!`);
});

client.on('messageCreate', async message => {
  if (message.content.startsWith('!chamado')) {
    const authorId = message.author.id;
    const msgContent = message.content.trim();

    const regex = /!chamado\nTITULO:\s*(.*?)\nDESCRICAO:\s*(.*?)\n(?:ID:\s*(.*?)\n)?(?:PRIORIDADE:\s*(.*))?/;
    const matches = regex.exec(msgContent);

    if (matches) {
      const dados = {
        titulo: matches[1].trim(),
        descricao: matches[2].trim(),
        id_cliente_ou_operacao: matches[3] ? matches[3].trim() : null,
        prioridade: matches[4] ? matches[4].trim() : null
      };

      if (!dados.titulo || !dados.descricao) {
        message.channel.send('Formato de mensagem incorreto. Certifique-se de fornecer pelo menos o título e a descrição!');
        return;
      }

      const LABELS = {
        Alta: HIGH_PRIORITY_LABEL_ID,
        Media: MEDIUM_PRIORITY_LABEL_ID,
        Baixa: LOW_PRIORITY_LABEL_ID,
      };

      const attachments = message.attachments.filter(attachment => attachment.url);
      const attachmentUrls = attachments.map(attachment => attachment.url);

      let descricaoComAnexos = dados.descricao;
      if (attachmentUrls.length > 0) {
        descricaoComAnexos += `%0A%0AAnexos:%0A` + attachmentUrls.join('%0A');
      }

      const labelPrioridade = dados.prioridade ? (LABELS[dados.prioridade] || LOW_PRIORITY_LABEL_ID) : null;

      let url = `${TRELLO_BASE_URL}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&idList=${TRELLO_BOARD_ID}&name=${encodeURIComponent(dados.titulo)}`;

      if (labelPrioridade) {
        url += `&idLabels=${labelPrioridade}`;
      }

      if (dados.id_cliente_ou_operacao) {
        url += `&desc=${encodeURIComponent(dados.descricao)}%0A%0AID: ${dados.id_cliente_ou_operacao}%0A%0AID do Autor: ${authorId}`;
      } else {
        url += `&desc=${encodeURIComponent(dados.descricao)}%0A%0AID do Autor: ${authorId}`;
      }

      try {
        const response = await fetch(url, { method: 'POST' });

        if (response.ok) {
          const card = await response.json();

          message.channel.send(`Chamado "${dados.titulo}" criado com sucesso!\n\nID do chamado: ${card.id}`);

          for (let i = 0; i < attachmentUrls.length; i++) {
            const imageUrl = attachmentUrls[i];

            const uploadUrl = `${TRELLO_BASE_URL}/cards/${card.id}/attachments?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&url=${encodeURIComponent(imageUrl)}`;

            try {
              await fetch(uploadUrl, { method: 'POST' });
            } catch (error) {
              console.error('Erro ao enviar imagem para o Trello:', error);
            }
          }
        } else {
          message.channel.send('Houve um erro ao criar a tarefa no Trello.');
        }
      } catch (error) {
        console.error(error);
        message.channel.send('Ocorreu um erro ao se comunicar com o Trello.');
      }
    } else {
      message.channel.send('Formato de mensagem incorreto. Use o formato: !chamado\nTITULO:\nDESCRICAO:\nID: ID Cliente (opcional)\nPRIORIDADE: Alta/Media/Baixa (opcional)');
    }
  } else if (message.content.startsWith('!status')) {

    const cardId = message.content.replace('!status ', '');

    const responseCard = await fetch(`${TRELLO_BASE_URL}/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);

    const card = await responseCard.json();

    const responseList = await fetch(`${TRELLO_BASE_URL}/lists/${card.idList}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);

    const list = await responseList.json();

    message.channel.send(`O status do chamado de ID ${cardId} é: ${list.name}`);
  }
});


client.login(BOT_DISCORD_TOKEN);
