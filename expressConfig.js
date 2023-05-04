import express from 'express'
import bodyParser from 'body-parser'
import * as Libp2p from "./Libp2p.js"

const app = express();

app.use(bodyParser.json({
    type(req) {
        return true;
    }
}));
const port = process.env.PORT;
app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
});

app.post('/remote-method/:module/:method', async (req, res) => {
    let response = await Libp2p.call(req);
    res.send(response);
});


