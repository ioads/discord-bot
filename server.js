
import dotenv from 'dotenv';
import express from 'express';
import bodyParser from 'body-parser';

dotenv.config();

const app = express();
app.use(bodyParser.json());

app.get('teste', (req, res) => {
    console.log('ok')
});

app.post('/trello-webhook', async (req, res) => {
  const action = req.body.action;

  if (action.type === 'updateCard' && action.data.listBefore && action.data.listAfter) {
    const cardName = action.data.card.name;
    const listBefore = action.data.listBefore.name;
    const listAfter = action.data.listAfter.name;

    if (listAfter === TRELLO_LIST_NAME_TO_WATCH) {
      const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);

      if (channel) {
        channel.send(`O card "${cardName}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
        console.log(`Mensagem enviada para o Discord: O card "${cardName}" foi movido da lista "${listBefore}" para a lista "${listAfter}".`);
      } else {
        console.error('Canal do Discord não encontrado!');
      }
    }
  }
  res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;
const TRELLO_LIST_NAME_TO_WATCH = 'DONE';

app.listen(PORT, () => {
  console.log(`Servidor webhook rodando na porta ${PORT}`);
});