const express = require('express')
const bodyParser = require("body-parser");
const mongoose = require('mongoose');
const fetch = require("node-fetch");
var TronWeb = require('tronweb');
const BigNumber = require('bignumber.js');

require('dotenv').config();
var cors = require('cors');

const tiempoWallets = 3600*1000;
const minTRX = 10000000;

const port = process.env.PORT || "3003";
const uri = process.env.APP_URI;
const TOKEN = process.env.APP_MT;
const PryKey = process.env.APP_PRYKEY;
const TRONGRID_API = process.env.APP_API || "https://api.trongrid.io";
const TRONGRID_API_EVENT = process.env.APP_API_EVENT || "https://api.trongrid.io";
const DepositWALLET =  process.env.APP_DEP_WALLET || "TB7RTxBPY4eMvKjceXj8SWjVnZCrWr4XvF";
const contractAddress = process.env.APP_CONTRACT || "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t";



var tronWeb = new TronWeb(
  TRONGRID_API,
  TRONGRID_API,
  TRONGRID_API_EVENT,
  PryKey
);

var contractUSDT;

tronWeb.contract().at(contractAddress)
.then((result)=>{
  console.log("contrato conectado ["+contractAddress+"]");
  contractUSDT = result;
  //console.log(contractUSDT)
})

//tronWeb.setAddress('TEf72oNbP7AxDHgmb2iFrxE2t1NJaLjTv5');
const app = express();

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
const options = { useNewUrlParser: true, useUnifiedTopology: true };

mongoose.connect(uri, options)
.then(async() => { console.log("Conectado Exitodamente a la base de datos");})
.catch(err => { console.log(err); });

const walletsTemp = mongoose.model('wallets', {

  wallet: String,
  data: Object, 
  ultimoUso: Number,
  usuario: String,
  disponible: Boolean

});

const transferencias = mongoose.model('transfer', {

  identificador: Number,
  tipo: String,
  moneda: String,
  cantidad: Number,
  from: String,
  to: String, 
  time: Number,
  usuario: String,
  timeCompletado: Number,
  completado: Boolean,
  pendiente: Boolean,
  cancelado: Boolean

});

async function crearWallet(){
  var acc =  await tronWeb.createAccount()

  acc = {
    wallet: acc.address.base58,
    data: acc,
    ultimoUso: Date.now(),
    usuario: "",
    disponible: true
  };

  var newWallet = new walletsTemp(acc);
  await newWallet.save();

  await asignarTRX(acc.address.base58);

  return acc;

}

async function asignarTRX(wallet){
  var balance = await tronWeb.trx.getBalance(wallet);
  if (balance < minTRX) {

    var hash = await tronWeb.trx.sendTransaction(wallet, minTRX, "asignar trx desde master");
    console.log(hash)
    
  }
  
}

async function buscarWalletsDisponibles(){

  var update = await walletsTemp.updateMany(
    {
      disponible: false
    },
    [

      {$set:{usuario: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$ultimoUso",tiempoWallets]} ] }, 
                then: ""
              }],
              default: "$usuario"
            } 
          } 
        }
      },
      {$set:{disponible: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$ultimoUso",tiempoWallets]} ] }, 
                then: true
              }],
              default: "$disponible"
            } 
          } 
        }
      },
      {$set:{ultimoUso: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$ultimoUso",tiempoWallets]} ] }, 
                then: Date.now()
              }],
              default: "$ultimoUso"
            } 
          } 
        }
      }
      

    ]
        

    
    
  )
  //console.log(update);

}

async function buscarMisTransferencias(){


  var update = await transferencias.updateMany({completado: false,cancelado: false},
    [

      {$set:{timeCompletado: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$time",tiempoWallets]} ] }, 
                then: Date.now()
              }],
              default: "$timeCompletado"
            } 
          } 
        }
      },
      {$set:{cancelado: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$time",tiempoWallets]} ] }, 
                then: true
              }],
              default: "$cancelado"
            } 
          } 
        }
      },
      {$set:{pendiente: {$switch: 
            {branches: [
              { 
                case: { $gte: [ Date.now(), {$sum:["$time",tiempoWallets]} ] }, 
                then: false
              }],
              default: "$pendiente"
            } 
          } 
        }
      }
      
    ]   
    
  )
  //console.log(update);

}

async function cancelarMiTransferencia(id){

  if(id){

    var miTransfers = await transferencias.find({identificador: id})

  if(miTransfers.length > 0 ){

    if (!miTransfers[0].completado) {

      var update = await walletsTemp.updateOne({wallet: miTransfers[0].to},
        [
          {$set:{disponible:true, usuario: ""}}
        ]
        )
  
      update = await transferencias.updateOne({identificador: id},
        [
    
          {$set:{timeCompletado: Date.now()}},
          {$set:{cancelado: true}},
          {$set:{pendiente: false}}
          
        ]   
        
      )
      console.log(update);
      return true;
      
    }else{
      return false;
    }

    
  }else{
    return false;
  }

  }else{
    return false;
  }

  

}

buscarMisTransferencias();

buscarWalletsDisponibles();

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

  await buscarWalletsDisponibles();

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
          to: tronWeb.address.fromHex(evento.result.to),
          time: Date.now()
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
  await buscarWalletsDisponibles();

  if(req.body.envios.length){
    var envios = req.body.envios;
  }else{
    var envios = JSON.parse(req.body.envios);
  }

  if (req.body.token === TOKEN && req.body.envios && envios.length) {
    var respuesta = {result:true};
    respuesta.data = [];
    for (let index = 0; index < envios.length; index++) {
      hash = await enviarUSDT(envios[index].wallet,envios[index].cantidad).catch(()=>{return "";})
      if (hash === "") {
        ok = false;
      }else{ 
        ok = true;
      }
      
      respuesta.data.push({ok:ok ,wallet: envios[index].wallet, cantidad: envios[index].cantidad, hash: hash, time: Date.now()})
    }


    
    res.send(respuesta)
  }else{
    res.send({result:false})
  }

});

app.post('/crear/deposito/', async(req,res) => {

  console.log("!!!SOLICITAR CREAR DEPOSITO!!!")

  await buscarWalletsDisponibles();

  var usuario = parseInt(req.body.id);

    if (req.body.token === TOKEN && req.body.id && !isNaN(usuario)) {

      await verificarDeposito(usuario);

      var miTransfers = [];

      var miTransfers = await transferencias.find({usuario: usuario}).sort({identificador: -1}).catch(()=>{return []})

      console.log(miTransfers.length)
      //console.log(miTransfers[0].usuario)

      var neworden = false;
      var ident = 0;
      if(miTransfers.length > 0){
        for (let index = 0; index < miTransfers.length; index++) {

          if(miTransfers[index].pendiente && !miTransfers[index].completado && !miTransfers[index].cancelado ){
            neworden = true;
            ident = index;
            console.log("orden pendiente "+miTransfers[ident].identificador)
            break;
          }
          
        }
      }

      //crear nueva orden de deposito?
      if(!neworden){

        var walletDeposito = await walletsTemp.find({disponible: true}).sort({ultimoUso: -1})
        
        if(walletDeposito.length === 0){
          walletDeposito[0] = await crearWallet();
        }

        console.log("crea nueva orden: "+walletDeposito[0].wallet)

        await walletsTemp.updateOne({wallet: walletDeposito[0].wallet},
          {$set:{disponible: false, usuario: usuario}})

        var totalTranfers = await transferencias.find({}).sort({identificador: -1});
        if(totalTranfers.length > 0){
          var identificador = totalTranfers.length;
        }else{
          identificador = 0;
        }
        

        var newtransfer = new transferencias({

          identificador: identificador,
          tipo: "deposito",
          moneda: "usdt(trc20)",
          cantidad: 0,
          from: "",
          to: walletDeposito[0].wallet, 
          time: Date.now(),
          usuario: req.body.id,
          timeCompletado: 0,
          completado: false,
          pendiente: true,
          cancelado: false
        
        });

        await newtransfer.save();

        res.send({
          result: true,
          sendTo: walletDeposito[0].wallet,
          ordenId: identificador,
          time: newtransfer.time,
          end: newtransfer.time+tiempoWallets
        });
      }else{

        res.send({
          result: true,
          sendTo: miTransfers[ident].to,
          ordenId: miTransfers[ident].identificador,
          time: miTransfers[ident].time,
          end: miTransfers[ident].time+tiempoWallets
        });

      }

    }else {
      res.send({
        result: false,
        time: Date.now()
      });
    }
  

});


async function verificarDeposito(id){

  var totalTranfers = await transferencias.find({identificador: id}).sort({time: -1})

  if(totalTranfers.length > 0){
    for (let index = 0; index < totalTranfers.length; index++) {
      var value = await contractUSDT.balanceOf(totalTranfers[index].to).call()
      value = new BigNumber(value._hex).shiftedBy(-6).toNumber();
      console.log(value)
      if(value > 0){

        await asignarTRX(totalTranfers[index].to);

        var estawallet = await walletsTemp.find({wallet: totalTranfers[index].to})
        estawallet = estawallet[0];

        var TEMPtronWeb = new TronWeb(
          TRONGRID_API,
          TRONGRID_API,
          TRONGRID_API_EVENT,
          estawallet.data.privateKey
        );

        var tempUST = await TEMPtronWeb.contract().at(contractAddress);
        var cantidad = await contractUSDT.balanceOf(totalTranfers[index].to).call()
        cantidad = new BigNumber(cantidad._hex).toString();
        console.log(cantidad)
        var hash = await tempUST.transfer(DepositWALLET,cantidad).send().catch(()=>{console.log("error sacar fondos");return "";})

        delete TEMPtronWeb;

        if(hash !== ""){
          await transferencias.updateOne({identificador: id},
            [
              {$set:{cantidad: value, from: hash, timeCompletado: Date.now(),completado: true}}
            ]
          )
  
          await walletsTemp.updateOne({wallet: totalTranfers[index].to},
            [
              {$set:{disponible: true, usuario: ""}}
            ]
            
          )
        }

       

      }
      
    }
    
  }

}

app.post('/consultar/deposito/id/', async(req,res) => {

  let id = parseInt(req.body.id);

  if (req.body.token !== TOKEN && isNaN(id) && !req.body.id) {
    res.send({
      result: false,
      time: Date.now()
    });
  }else{

    await verificarDeposito(id);
    
    var totalTranfers = await transferencias.find({identificador: id}).sort({time: -1})

      if (totalTranfers.length > 0) {

        res.send({
          result: true,
          idDeposito: id,
          data: totalTranfers[0],
          time: Date.now()
        });
      }else {
        res.send({
          result: false,
          time: Date.now()
        });
      }

  }
  await buscarWalletsDisponibles();

  

});

app.post('/consultar/depositos/usuario/', async(req,res) => {

  let id = req.body.id;

  if (req.body.token !== TOKEN && !req.body.id) {
    res.send({
      result: false,
      time: Date.now()
    });
  }else{

    var miTransfers = await transferencias.find({usuario: id, tipo: "deposito"},{_id:0,__v:0,usuario:0}).sort({identificador: -1});

      if (miTransfers.length > 0) {

        res.send({
          result: true,
          usuario: id,
          data: miTransfers,
          time: Date.now()
        });
      }else {
        res.send({
          result: false,
          time: Date.now()
        });
      }
  }

  await buscarWalletsDisponibles();

  

});

app.post('/cancelar/deposito/id/', async(req,res) => {

  let id = req.body.id;

  if (req.body.token !== TOKEN && !req.body.id) {

    res.send({
      result: false,
      time: Date.now()
    });
  }else{

    await verificarDeposito(id);

      if (await cancelarMiTransferencia(id)) {

        res.send({
          result: true,
          idDeposito: id,
          time: Date.now()
        });
      }else {
        res.send({
          result: false,
          time: Date.now()
        });
      }

  }
  await buscarWalletsDisponibles();

});

app.listen(port, ()=> console.log('Escuchando Puerto: ' + port))