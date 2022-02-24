const express = require('express')
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const fetch = require("node-fetch");
var TronWeb = require('tronweb');
const BigNumber = require('bignumber.js');

require('dotenv').config();
var cors = require('cors');

const app = express();

app.use(cors());

const port = process.env.PORT || "3003";
const TOKEN = process.env.APP_MT;
const PryKey = process.env.APP_PRYKEY;
const TRONGRID_API = process.env.APP_API || "https://api.trongrid.io";
const TRONGRID_API_EVENT = process.env.APP_API_EVENT || "https://api.trongrid.io";

const contractAddress = process.env.APP_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";

var tronWeb = new TronWeb(
  TRONGRID_API,
  TRONGRID_API,
  TRONGRID_API_EVENT,
  PryKey
);

//tronWeb.setAddress('TEf72oNbP7AxDHgmb2iFrxE2t1NJaLjTv5');

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

    var evento = await tronWeb.getEventByTransactionID(id)
    evento = evento[0];

    console.log(evento)

    var value = await tronWeb.trx.getTransaction(id)

      //console.log(value)
    //  console.log(value.ret[0].contractRet);

      if (value.ret[0].contractRet === 'SUCCESS' && evento.name === 'Transfer' ) {

        value = new BigNumber(evento.result.value);
        value = value.shiftedBy(-6).toNumber();

        res.send({
          result: true,
          value: value,
          from: tronWeb.address.fromHex(evento.result.from),
          to: tronWeb.address.fromHex(evento.result.to)
        });
      }else {
        res.send({
          result: false,
          value: 0
        });
      }
    

});


async function enviarUSDT(wallet,cantidadUSDT){

  var contractUSDT = await tronWeb.contract().at(contractAddress);

  cantidadUSDT = parseInt(cantidadUSDT * 10**6);

  if(cantidadUSDT < 1)return "";

  var hash = await contractUSDT.transfer(wallet, cantidadUSDT).send().catch(()=>{return "";})
  
  return hash;

}


app.post('/enviar/usdt', async(req,res) => {
  if(req.body.envios.length){
    var envios = req.body.envios;
  }else{
    var envios = JSON.parse(req.body.envios);
  }

  var token = req.body.token;

  if (token === TOKEN && req.body.envios && envios.length) {
    var respuesta = {result:true};
    respuesta.data = [];
    for (let index = 0; index < envios.length; index++) {
      hash = await enviarUSDT(envios[index].wallet,envios[index].cantidad).catch(()=>{return "";})
      if (hash === "") {
        ok = false;
      }else{
        ok = true;
      }
      
      respuesta.data.push({ok:ok ,wallet: envios[index].wallet, cantidad: envios[index].cantidad, hash: hash})
    }


    
    res.send(respuesta)
  }else{
    res.send({result:false})
  }

});

app.listen(port, ()=> console.log('Escuchando Puerto: ' + port))

