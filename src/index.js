const express = require('express')
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const fetch = require("node-fetch");
var TronWeb = require('tronweb');

require('dotenv').config();
var cors = require('cors');

const app = express();

app.use(cors());

const port = process.env.PORT || "3003";
const token = process.env.APP_MT;
const uri = process.env.APP_URI;
const TRONGRID_API = process.env.APP_API || "https://api.trongrid.io";

const contractAddress = process.env.APP_CONTRACT || "TF1aXPN5kZwPsaFjrFPD7jBKPpAzXYdR8S";

console.log(TRONGRID_API);

TronWeb = new TronWeb(
  TRONGRID_API,
  TRONGRID_API,
  TRONGRID_API
);

TronWeb.setAddress('TEf72oNbP7AxDHgmb2iFrxE2t1NJaLjTv5');

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());


app.get('/', async(req,res) => {

 res.send("ok")


});

app.get('/precio/usd/trx', async(req,res) => {
/*
  let data = await CoinGeckoClient.simple.price({
      ids: ['tron'],
      vs_currencies: ['usd']
  });
  //console.log(data);*/

  var apiUrl = 'https://data.gateapi.io/api2/1/marketlist';
  const response = await fetch(apiUrl)
  .catch(error =>{console.error(error)})
  const json = await response.json();

  var upd = json.data.find(element => element.pair == "trx_usdt");

  //console.log(upd.rate);

  res.status(200).send({
    "data":{
      "tron":{
        "usd":parseFloat(upd.rate)
      }
    }
  })

});

app.get('/consultar/transaccion/:id', async(req,res) => {

    let id = req.params.id;

    TronWeb.trx.getTransaction(id)
    .then(value=>{
    //  console.log(value.ret[0].contractRet);

      if (value.ret[0].contractRet === 'SUCCESS') {

        res.send({result: true});
      }else {
        res.send({result: false});
      }
    })
    .catch(value=>{
      console.log(value);
      res.send({result: false});
    })

});


app.post('/enviar/usdt', async(req,res) => {
  var wallet =  req.body.wallet

  if (req.body.wallet) {
    res.send({result:true})
  }else{
    res.send({result:false})
  }

});

app.listen(port, ()=> console.log('Escuchando Puerto: ' + port))
