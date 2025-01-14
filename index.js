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
const TRELLO_LIST_ID = process.env.TRELLO_LIST_ID;
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
        channel.send(`Olá, <@${authorId}>! O chamado "${cardName}" de ID "${cardId}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
        console.log(`Mensagem enviada para o Discord: O chamado "${cardName}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
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
const TRELLO_LIST_NAME_TO_WATCH = 'CONCLUÍDO';

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

    const regex = /!chamado\nTITULO:\s*(.*?)\nDESCRICAO:\s*(.*?)\n(?:ID USUARIO:\s*(.*?)\n)?(?:CPF USUARIO:\s*(.*?)\n)?(?:OPERACAO:\s*(.*?)\n)?(?:PRIORIDADE:\s*(.*))?/;
    const matches = regex.exec(msgContent);

    if (matches) {
      const dados = {
        titulo: matches[1].trim(),
        descricao: matches[2].trim(),
        id_usuario: matches[3] ? matches[3].trim() : null,
        cpf_usuario: matches[4] ? matches[4].trim() : null,
        operacao: matches[5] ? matches[5].trim() : null,
        prioridade: matches[6] ? matches[6].trim() : null
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

      let url = `${TRELLO_BASE_URL}/cards?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}&idList=${TRELLO_LIST_ID}&name=${encodeURIComponent(dados.titulo)}`;

      if (labelPrioridade) {
        url += `&idLabels=${labelPrioridade}`;
      }

      url += `&desc=${encodeURIComponent(dados.descricao)}%0A%0AID USUARIO: ${dados.id_usuario}%0A%0ACPF USUARIO: ${dados.cpf_usuario}%0A%0AOPERACAO: ${dados.operacao}%0A%0AID do Autor: ${authorId}`;
    
      try {
        const response = await fetch(url, { method: 'POST' });

        if (response.ok) {
          const card = await response.json();

          message.channel.send(`Chamado "${dados.titulo}" criado com sucesso!\n\nID do chamado: ${card.id}\nUtilize o comando !status id-do-chamado para consultar o status do seu chamado.`);

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
      message.channel.send('Formato de mensagem incorreto. Use o formato: !chamado\nTITULO: Informe um título para o chamado\nDESCRICAO: Informe aqui a descrição do erro\nID USUARIO: Informe o ID do usuário que está apresentando erro (opcional)\nCPF USUARIO: Informe o CPF do usuário que está apresentando erro (opcional)\nOPERACAO: Betao/7Games/R7 (opcional)\nPRIORIDADE: Alta/Media/Baixa (opcional)');
    }
  } else if (message.content.startsWith('!status')) {

    const cardId = message.content.replace('!status ', '');

    const responseCard = await fetch(`${TRELLO_BASE_URL}/cards/${cardId}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);

    const card = await responseCard.json();

    const responseList = await fetch(`${TRELLO_BASE_URL}/lists/${card.idList}?key=${TRELLO_API_KEY}&token=${TRELLO_TOKEN}`);

    const list = await responseList.json();

    message.channel.send(`O status do chamado de ID ${cardId} é: ${list.name}`);
  } else if (message.content.startsWith('!ajuda')) {
    message.channel.send('Olá, sou o TaskBot. Para criar um chamado utilizando meus comandos, basta usar o seguinte formato:\n\n!chamado\nTITULO: Informe um título para o chamado\nDESCRICAO: Informe aqui a descrição do erro\nID USUARIO: Informe o ID do usuário que está apresentando erro (opcional)\nCPF USUARIO: Informe o CPF do usuário que está apresentando erro (opcional)\nOPERACAO: Betao/7Games/R7 (opcional)\nPRIORIDADE: Alta/Media/Baixa (opcional)\n\nPara inserir imagens, basta adicionar anexos na mesma mensagem que está criando o chamado.');
  } else if (message.content.startsWith('!comandos')) {
    message.channel.send('Olá, sou o TaskBot. Os seguintes comandos estão disponíveis para você:\n\n!chamado Para criar uma nova solicitação de correção de bug.\n!status id-do-chamado Para verificar o status do seu chamado aberto.\n!ajuda Para verificar os campos necessários e formato do texto para criação de chamado.');
  }
});

client.login(BOT_DISCORD_TOKEN);