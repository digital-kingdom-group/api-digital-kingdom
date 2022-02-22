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

const options = { useNewUrlParser: true, useUnifiedTopology: true };

mongoose.connect(uri, options).then(
  () => { console.log("Conectado Exitodamente!");},
  err => { console.log(err); }
);

var user = mongoose.model('usuarios', {
        wallet: String,
        id: Number,
        active: Boolean,
        txhash: String,
        balance: Number,
        frozen: Number,
        deposit: [{
          amount: Number,
          start: Number,
          end: Number,
          finalized: Boolean,
          txhash: String

        }],
        record: [{
          amount: Number,
          method: String,
          date: Number,
          done: Boolean,
          dateSend: Number

        }],
        txs: [String]

    });



var usuariobuscado = 'TB7RTxBPY4eMvKjceXj8SWjVnZCrWr4XvF';

app.get('/', async(req,res) => {

    mongoose.connect(uri, options).then(
      () => { res.send("Conectado a mongoDB Exitodamente!");},
      err => { res.send(err); }
    );


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

app.get('/precio/gpxs/usd', async(req,res) => {


  var apiUrl = 'https://data-asg.goldprice.org/dbXRates/USD';
  const response = await fetch(apiUrl)
  .catch(error =>{console.error(error)})
  const json = await response.json();


  res.status(200).send({
    "data":{
      "gpxs":{
        "usd":parseFloat(json.items[0].xauPrice)
      },
      "usd":{
        "gpxs":parseFloat(1/json.items[0].xauPrice)
      }
    }
  })

  //res.status(200).send(data)

});


app.get('/consultar/todos', async(req,res) => {

    usuario = await user.find({}, function (err, docs) {});

    /*var array1 = usuario.slice(0, 184);
    array1.push(usuario[1156]);
    var array2 = usuario.slice(184, 1156);
    var array3 = usuario.slice(1157, usuario.length);

    array1 = [...array1,...array2,...array3];*/


    res.status(200).send(usuario);

});

app.get('/consultar/ejemplo', async(req,res) => {

    usuario = await user.find({ wallet: usuariobuscado }, function (err, docs) {});
    usuario = usuario[0];
    //console.log(usuario);

    res.send(usuario);

});

app.get('/consultar/transaccion/:id', async(req,res) => {

    let id = req.params.id;

    await TronWeb.trx.getTransaction(id)
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


app.get('/consultar/:direccion', async(req,res) => {

    let cuenta = req.params.direccion;
    let respuesta = {};
    var usuario = await user.find({ wallet: cuenta }, {_id:0});
    if (usuario.length >= 1) {
      usuario = usuario[0];
    }
    //console.log(usuario);

    var contrato = await TronWeb.contract().at(contractAddress);
    var decimales = await contrato.decimals().call();

    var saldo = await contrato.balanceOf(cuenta).call();
    saldo = parseInt(saldo._hex)/10**decimales;

    var frozen = await contrato.balanceFrozen(cuenta).call();
    frozen = parseInt(frozen._hex)/10**decimales;

    var investor = await contrato.investors(cuenta).call();

    if ( usuario == "" ) {

        respuesta = {
          wallet: cuenta,
          id: parseInt(investor.id),
          active: false,
          txhash: "",
          balance: saldo,
          frozen: frozen,
          deposit: [{
            amount: 0,
            start: 0,
            end: 0,
            finalized: false,
            tx_hash: ""

          }],
          record: [{
            amount: 0,
            method: 'N/A',
            date: 0,
            done: false,
            dateSend: 0

          }],
          txs: []

       }

        respuesta.txt = "Esta cuenta no está registrada";
        res.status(200).send(respuesta);

    }else{
        res.status(200).send(usuario);
    }

});

app.post('/registrar/:direccion', async(req,res) => {

    let cuenta = req.params.direccion;
    let token2 = req.body.token;
    let id = req.body.id;
    let txhash = req.body.txhash
    let respuesta = {};

    var contrato = await TronWeb.contract().at(contractAddress);
    var decimales = await contrato.decimals().call();

    var saldo = await contrato.balanceOf(cuenta).call();
    saldo = parseInt(saldo._hex)/10**decimales;

    var frozen = await contrato.balanceFrozen(cuenta).call();
    frozen = parseInt(frozen._hex)/10**decimales;

    var ids = await contrato.ids(cuenta).call();

  
    if (await TronWeb.isAddress(cuenta) && token == token2) {

      usuario = await user.find({ wallet: cuenta }, {_id:0});

        if ( usuario != "" ) {
            respuesta = usuario[0];
            respuesta.txt = "Cuenta ya registrada";

            res.status(303).send(respuesta);

        }else{

             var users = new user({
                wallet: cuenta,
                id: id,
                active: ids,
                txhash: txhash,
                balance: saldo,
                frozen: frozen,
                deposit: [],
                record: [],
                txs: [txhash]
            });

            users.save().then(() => {
                respuesta.txt = "Usuario creado exitodamente";
                respuesta.usuario = users;

                res.status(200).send(respuesta);
            });

        }
    }else{
        respuesta.txt = "Ingrese una dirección de TRX";
        res.status(200).send(respuesta);
    }


});

app.post('/actualizar/:direccion', async(req,res) => {

    let cuenta = req.params.direccion;
    let token2 = req.body.token;
    let datos = req.body;

    if ( token == token2 ) {
      var usuario = await user.find({ wallet: cuenta }, function (err, docs) {});
      if (usuario.length > 0) {
        usuario = usuario[0];
      }

      usuario.txs[usuario.txs.length] = datos.txs;

      var final = await user.updateOne({ wallet: cuenta }, usuario);
      res.send(final);

    }else{
      res.send("No autorizado");

    }

});

app.get('/actualizar/:direccion', async(req,res) => {

  let cuenta = req.params.direccion;
  let datos = req.body

  if (await TronWeb.isAddress(cuenta) ) {

    var contrato = await TronWeb.contract().at(contractAddress);
    var decimales = await contrato.decimals().call();

    var usuario = await user.find({ wallet: cuenta }, {_id:0});

    if (usuario.length > 0) {
      usuario = usuario[0];
    }

    var saldo = await contrato.balanceOf(cuenta).call();
    saldo = parseInt(saldo._hex)/10**decimales;

    var frozen = await contrato.balanceFrozen(cuenta).call();
    frozen = parseInt(frozen._hex)/10**decimales;

    var ids = await contrato.ids(cuenta).call();

    var investor = await contrato.investors(cuenta).call();

    var deposito = [];


    if (ids && frozen > 0 ) {

      var deposito1 = await contrato.viewDeposits(cuenta,0).call();

      for (let i = 0; i < parseInt(deposito1[4]._hex); i++) {

        deposito1 = await contrato.viewDeposits(cuenta,i).call();

        deposito1[0] = parseInt(deposito1[0]._hex);
        deposito1[1] = parseInt(deposito1[1]._hex);
        deposito1[2] = parseInt(deposito1[2]._hex)/10**decimales;

        if(deposito1[3] && Date.now()/1000 > deposito1[1]){
          //true
          texto = true;
        }else{
          //false

          if( parseInt(investor.paidAt._hex) > deposito1[1]){
            //reclamado
            texto = false;
          }else{
            //no disponible para reclamar en proceso
            texto = false;
          }
          
        }

        deposito2 = {};

        deposito2.amount = deposito1[2];
        deposito2.start = deposito1[0];
        deposito2.end = deposito1[1];
        deposito2.finalized = texto;
        deposito2.txhash = "";
        if(usuario.txs){
          if(usuario.txs.length > i){
          deposito2.txhash = usuario.txs[i];
          }
        }
        
        deposito[i] = deposito2;
      }
    }

    console.log(usuario);


    if ( usuario == "" ) {

      usuario = {
          wallet: cuenta,
          id: parseInt(investor.id),
          active: ids,
          txhash: "",
          balance: saldo,
          frozen: frozen,
          deposit: [{
            amount: 0,
            start: 0,
            end: 0,
            finalized: false

          }],
          record: [{
            amount: 0,
            method: 'N/A',
            date: 0,
            done: false,
            dateSend: 0

          }],
          txs: []

        }
      res.send(usuario);

    }else{
      datos = usuario;

      datos.id = parseInt(investor.id);

      datos.active = ids;

      datos.balance = saldo;

      datos.frozen = frozen;

      datos.deposit = deposito;
      
      update = await user.updateOne({ wallet: cuenta }, datos);

      delete datos.txs;

      res.send(datos);
    }

  }
  


});

app.get('/blockchain/:direccion', async(req,res) => {

  let cuenta = req.params.direccion;
  let datos = req.body

  var contrato = await TronWeb.contract().at(contractAddress);
  var decimales = await contrato.decimals().call();

  var saldo = await contrato.balanceOf(cuenta).call();
  saldo = parseInt(saldo._hex)/10**decimales;

  var frozen = await contrato.balanceFrozen(cuenta).call();
  frozen = parseInt(frozen._hex)/10**decimales;

  var ids = await contrato.ids(cuenta).call();

  var investor = await contrato.investors(cuenta).call();

  var deposito = [];

  var balanceFrozen = await contrato.balanceFrozen(cuenta).call();

  balanceFrozen = parseInt(balanceFrozen);


  if (ids && balanceFrozen > 0 ) {

    var deposito1 = await contrato.viewDeposits(cuenta,0).call();

        
    for (let i = 0; i < parseInt(deposito1[4]._hex); i++) {

      deposito1 = await contrato.viewDeposits(cuenta,i).call();

      deposito1[0] = parseInt(deposito1[0]._hex);
      deposito1[1] = parseInt(deposito1[1]._hex);
      deposito1[2] = parseInt(deposito1[2]._hex)/10**decimales;

      texto = false;

      if( parseInt(investor.paidAt._hex) > deposito1[1]){
        //reclamado
        texto = true;
      }
        

      deposito2 = {};

      var firma = deposito1[0]+deposito1[1]+deposito1[2];

      deposito2.sing = TronWeb.sha3(firma+"");
      deposito2.amount = deposito1[2];
      deposito2.start = deposito1[0];
      deposito2.end = deposito1[1];
      deposito2.finalized = texto;

      if(deposito2.amount > 0){
        deposito.push(deposito2);
      }

    }
  }

    datos = {};

    datos.id = parseInt(investor.id);

    datos.active = ids;

    datos.balance = saldo;

    datos.frozen = frozen;

    datos.deposit = deposito;

    res.send(datos);

});



app.listen(port, ()=> console.log('Escuchando Puerto: ' + port))
