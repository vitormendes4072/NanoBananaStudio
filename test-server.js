import express from 'express';
const app = express();
app.get('/', (req, res) => res.send('OK'));
const server = app.listen(3005, () => {
  console.log('Listening on 3005');
});
process.on('exit', () => console.log('EXITING'));
