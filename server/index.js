const express=require('express');const http=require('http');const {Server}=require('socket.io');
const game=require('./game');
const app=express();const server=http.createServer(app);const io=new Server(server);app.use(express.static('public'));
const rooms=new Map();
function newRoom(code){return {code,players:[],teams:[{name:'الفريق 1',score:0,wins:0},{name:'الفريق 2',score:0,wins:0}],game:game.createGame(),round:0,target:game.RULES.target,chat:[]}}
function state(r){return {code:r.code,players:r.players.map(p=>({id:p.id,name:p.name,seat:p.seat,online:p.online})),teams:r.teams,phase:r.game.phase,bid:r.game.bid,trump:r.game.trump,turn:r.game.turn,trick:r.game.trick,tricksWon:r.game.tricksWon,trickPoints:r.game.trickPoints,declarerTeam:r.game.declarerTeam,multiplier:r.game.multiplier,scores:r.teams.map(t=>t.score),round:r.round,target:r.target,chat:r.chat.slice(-40),rules:game.RULES}}
function sendState(r){io.to(r.code).emit('state',state(r));r.players.forEach(p=>{if(p.online)io.to(p.id).emit('hand',r.game.hands[p.seat]||[])})}
function currentRoom(s){return rooms.get(s.data.room)}
function emitError(s,msg){s.emit('errorMsg',msg)}
io.on('connection',socket=>{
 socket.on('join',({code,name})=>{code=String(code||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);name=String(name||'لاعب').trim().slice(0,20);if(!code)return emitError(socket,'رمز الغرفة مطلوب');let r=rooms.get(code)||newRoom(code);if(r.players.length>=4)return emitError(socket,'الغرفة ممتلئة');const seat=[0,1,2,3].find(x=>!r.players.some(p=>p.seat===x));r.players.push({id:socket.id,name,seat,online:true});rooms.set(code,r);socket.join(code);socket.data.room=code;socket.data.seat=seat;socket.emit('joined',{seat,code});sendState(r)});
 socket.on('start',()=>{const r=currentRoom(socket);if(!r||r.players.length!==4)return emitError(socket,'يلزم 4 لاعبين');if(r.game.phase!=='lobby'&&r.game.phase!=='round_end')return emitError(socket,'الجولة جارية');game.deal(r.game);r.round++;sendState(r)});
 socket.on('bid',({amount,trump})=>{const r=currentRoom(socket);if(!r)return;const x=game.placeBid(r.game,socket.data.seat,Number(amount),trump);if(!x.ok)return emitError(socket,x.error);sendState(r)});
 socket.on('pass',()=>{const r=currentRoom(socket);if(!r)return;const x=game.passBid(r.game,socket.data.seat);if(!x.ok)return emitError(socket,x.error);if(x.redeal){game.deal(r.game);r.round++;}sendState(r)});
 socket.on('coinche',()=>{const r=currentRoom(socket);if(!r)return;const x=game.coinche(r.game,socket.data.seat);if(!x.ok)return emitError(socket,x.error);sendState(r)});
 socket.on('surcoinche',()=>{const r=currentRoom(socket);if(!r)return;const x=game.surcoinche(r.game,socket.data.seat);if(!x.ok)return emitError(socket,x.error);sendState(r)});
 socket.on('playCard',({cardId})=>{const r=currentRoom(socket);if(!r)return;const x=game.play(r.game,socket.data.seat,cardId);if(!x.ok)return emitError(socket,x.error);if(x.finished){const result=game.scoreRound(r.game);if(result){r.teams[result.made?result.declaring:result.defending].score+=result.delta;r.game.result=result;const winner=r.teams.findIndex(t=>t.score>=r.target);if(winner>=0){r.teams[winner].wins++;r.game.phase='match_end';r.game.matchWinner=winner}}}sendState(r)});
 socket.on('chat',msg=>{const r=currentRoom(socket);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(!p)return;const text=String(msg||'').trim().slice(0,300);if(!text)return;r.chat.push({name:p.name,text,ts:Date.now()});sendState(r)});
 socket.on('newMatch',()=>{const r=currentRoom(socket);if(!r)return;r.teams.forEach(t=>t.score=0);r.round=0;r.game=game.createGame();sendState(r)});
 socket.on('disconnect',()=>{const r=currentRoom(socket);if(!r)return;const p=r.players.find(x=>x.id===socket.id);if(p)p.online=false;sendState(r)});
});
server.listen(process.env.PORT||3000,()=>console.log('Coinche server listening on '+(process.env.PORT||3000)));
