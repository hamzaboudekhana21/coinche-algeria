const SUITS=['♠','♥','♦','♣'];
const RANKS=['7','8','9','10','J','Q','K','A'];
const TRUMP_ORDER=['J','9','A','10','K','Q','8','7'];
const PLAIN_ORDER=['A','10','K','Q','J','9','8','7'];
const TRUMP_VALUE={J:20,9:14,A:11,10:10,K:4,Q:3,8:0,7:0};
const PLAIN_VALUE={A:11,10:10,K:4,Q:3,J:2,9:0,8:0,7:0};

const RULES={target:3000,minimumBid:80,bidStep:10,tricks:8,beloteBonus:20,lastTrickBonus:10,coincheMultiplier:2,surcoincheMultiplier:4};
const teamOf=seat=>seat%2;
const cardKey=c=>`${c.s}${c.r}`;
const makeDeck=()=>SUITS.flatMap(s=>RANKS.map(r=>({s,r,id:cardKey({s,r})})));
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function rankIndex(card,trump){return (trump===card.s?TRUMP_ORDER:PLAIN_ORDER).indexOf(card.r)}
function value(card,trump){return trump===card.s?TRUMP_VALUE[card.r]:PLAIN_VALUE[card.r]}
function cardPoints(cards,trump){return cards.reduce((n,c)=>n+value(c,trump),0)}
function canFollow(hand,lead,trump){return hand.some(c=>c.s===lead)||(!hand.some(c=>c.s===trump)&&hand.some(c=>c.s===lead))}
function legalCards(hand,trick,trump){
  if(!trick.length)return hand;
  const lead=trick[0].card.s;
  const leadCards=hand.filter(c=>c.s===lead);
  if(leadCards.length)return leadCards;
  const trumpCards=hand.filter(c=>c.s===trump);
  if(!trumpCards.length)return hand;
  const trumpsOnTable=trick.filter(x=>x.card.s===trump).map(x=>x.card);
  if(!trumpsOnTable.length)return trumpCards;
  const highest=trumpsOnTable.reduce((a,b)=>rankIndex(a,trump)<rankIndex(b,trump)?a:b);
  const higher=trumpCards.filter(c=>rankIndex(c,trump)<rankIndex(highest,trump));
  return higher.length?higher:trumpCards;
}
function winnerOfTrick(trick,trump){const lead=trick[0].card.s;let best=trick[0];for(const x of trick.slice(1)){const a=x.card,b=best.card;const aTrump=a.s===trump,bTrump=b.s===trump;if(aTrump&&!bTrump){best=x;continue}if(aTrump===bTrump){if(aTrump&&rankIndex(a,trump)<rankIndex(b,trump))best=x;else if(!aTrump&&a.s===lead&&b.s!==lead)best=x;else if(a.s===b.s&&rankIndex(a,trump)<rankIndex(b,trump))best=x}}return best.player}
function createGame(){return {phase:'lobby',bid:null,trump:null,turn:null,trick:[],tricksWon:[0,0],trickPoints:[0,0],hands:Array(4).fill(null).map(()=>[]),declarerTeam:null,multiplier:1,coinched:false,surcoinched:false,belote:Array(4).fill(false),lastWinner:null}}
function deal(g){const d=shuffle(makeDeck());g.hands=Array(4).fill(null).map((_,i)=>d.slice(i*8,(i+1)*8));g.phase='bidding';g.bid=null;g.trump=null;g.turn=0;g.trick=[];g.tricksWon=[0,0];g.trickPoints=[0,0];g.declarerTeam=null;g.multiplier=1;g.coinched=false;g.surcoinched=false;g.lastWinner=null;g.belote=[false,false,false,false]}
function placeBid(g,seat,amount,trump){if(g.phase!=='bidding'||g.turn!==seat)return {ok:false,error:'ليس دورك للمزايدة'};if(!Number.isInteger(amount)||amount<RULES.minimumBid||amount%RULES.bidStep!==0)return {ok:false,error:'مزايدة غير صالحة'};if(g.bid&&amount<=g.bid.amount)return {ok:false,error:'يجب رفع المزايدة'};if(!SUITS.includes(trump))return {ok:false,error:'الأتوت غير صالح'};g.bid={amount,trump,seat};g.turn=(seat+1)%4;return {ok:true}}
function passBid(g,seat){if(g.phase!=='bidding'||g.turn!==seat)return {ok:false,error:'ليس دورك'};g.turn=(seat+1)%4;g._passes=(g._passes||0)+1;if(g._passes>=3&&!g.bid){g.phase='redeal';return {ok:true,redeal:true}}if(g.bid&&g._passes>=3){g.phase='play';g.trump=g.bid.trump;g.declarerTeam=teamOf(g.bid.seat);g.turn=(g.bid.seat+1)%4;g._passes=0}return {ok:true}}
function coinche(g,seat){if(g.phase!=='bidding'||!g.bid)return {ok:false,error:'لا توجد مزايدة'};const declarerTeam=teamOf(g.bid.seat);if(teamOf(seat)===declarerTeam)return {ok:false,error:'لا يمكنك Coinche على فريقك'};g.declarerTeam=declarerTeam;g.multiplier=2;g.coinched=true;return {ok:true}}
function surcoinche(g,seat){if(!g.coinched||g.surcoinched||g.phase!=='bidding')return {ok:false,error:'Surcoinche غير متاح'};if(teamOf(seat)!==teamOf(g.bid.seat))return {ok:false,error:'Surcoinche للفريق المصرح'};g.declarerTeam=teamOf(g.bid.seat);g.multiplier=4;g.surcoinched=true;return {ok:true}}
function play(g,seat,cardId){if(g.phase!=='play'||g.turn!==seat)return {ok:false,error:'ليس دورك'};const hand=g.hands[seat],idx=hand.findIndex(c=>c.id===cardId);if(idx<0)return {ok:false,error:'هذه الورقة ليست في يدك'};const allowed=legalCards(hand,g.trick,g.trump);if(!allowed.some(c=>c.id===cardId))return {ok:false,error:'يجب احترام اللون/الأتوت'};const card=hand.splice(idx,1)[0];g.trick.push({player:seat,card});if(g.trick.length<4){g.turn=(seat+1)%4;return {ok:true,finished:false}}const winner=winnerOfTrick(g.trick,g.trump),team=teamOf(winner);g.tricksWon[team]++;g.trickPoints[team]+=cardPoints(g.trick.map(x=>x.card),g.trump);g.lastWinner=winner;g.trick=[];if(g.hands.every(h=>h.length===0)){g.trickPoints[team]+=RULES.lastTrickBonus;g.phase='round_end';g.turn=null;return {ok:true,finished:true,winnerTeam:team}}g.turn=winner;return {ok:true,finished:false,winnerTeam:team}}
function scoreRound(g){if(g.phase!=='round_end'||!g.bid)return null;const declaring=g.declarerTeam,defending=1-declaring,contract=g.bid.amount;const made=g.trickPoints[declaring]>=contract;const points=made?g.trickPoints[declaring]:contract;const delta=points*g.multiplier;return {made,declaring,defending,delta,contract,trickPoints:[...g.trickPoints],multiplier:g.multiplier}}
module.exports={RULES,SUITS,RANKS,teamOf,makeDeck,shuffle,legalCards,winnerOfTrick,createGame,deal,placeBid,passBid,coinche,surcoinche,play,scoreRound};
