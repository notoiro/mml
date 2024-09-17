const VML = require("./index.js");
const { default:axios } = require('axios');
const { OfflineAudioContext } = require('node-web-audio-api');
const toWav = require('audiobuffer-to-wav');
const fs = require('fs');

const rpc = axios.create({baseURL: 'http://127.0.0.1:50021/', proxy: false});

// param: score:object
// ret: query_data:object
async function query(score){
  const query = await rpc.post(`sing_frame_audio_query?speaker=6000`, JSON.stringify(score), {
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  const query_data = (await query).data;

  return query_data;
}

// param: query:object, id:str
// ret: synth_data:arraybuffer
async function sing(query, id){
  const synth = await rpc.post(`frame_synthesis?speaker=${id}`, JSON.stringify(query), {
    responseType: 'arraybuffer',
    headers: {
      Accept: 'audio/wav',
      "Content-Type": 'application/json'
    }
  });
  return new Uint8Array(synth.data).buffer;
  // fs.writeFileSync(file_path, new Buffer.from(synth.data), 'binary');
}

function linearInterpolation(x1, y1, x2, y2, x,){
  return y1 + ((y2 - y1) * (x - x1)) / (x2 - x1);
}

// 本家と違ってフェードアウト対象の休符の長さは固定なので1フレーム想定はしない。
function fadeout(query, score, length){
  let start = 0;
  for(let i = 0; i < score.length -1; i++) start += score[i].frame_length;
  const f_length = score[score.length -1].frame_length;

  for(let i = 0; i < length; i++){
    query.volume[start + i] *= linearInterpolation(0, 1, length - 1, 0, i);;
  }

  for(let i = length; i < f_length; i++){
    query.volume[start + i] = 0;
  }

  return query;
}

async function main(){
  const vml = new VML();

  let song;
  try{
    song = vml.parse_voicevox(process.argv[2], 0);
  }catch(e){
    console.log(e);
    process.exit(1);
  }

  for(let t of song.tracks){
    // 先頭の休符は元々指定されてるもの、4分のうち小さい方を採用する。
    // なおかつ0.12秒以下の場合には0.12秒にする。
    const first_length = Math.max(Math.min(t.distance, vml.calc_frame(vml.calc_ms('4', song.tempo))), vml.calc_frame(120));

    t.notes.unshift({ key: null, frame_length: first_length, lyric: ''  });
    t.notes.push({ key: null, frame_length: vml.calc_frame(500), lyric: '' });

    let q = await(query(t));

    t.query = fadeout(q, t.notes, vml.calc_frame(150))
  }

  let last_note = song.tracks[song.tracks.length -1].notes;
  last_note = last_note[last_note.length -2];

  const channel = 2;
  const length = (last_note.ms_pos + last_note.ms + vml.calc_ms('1', song.tempo)) * 0.001; // 最後のノートの位置+最後のノートの長さ+1分
  const sample = 48000;

  console.log(length, sample);

  const off_ctx = new OfflineAudioContext(channel, sample * length, sample);

  for(let q of song.tracks){
    const synth_data = await sing(q.query, 3014);
    const synth_buf = await off_ctx.decodeAudioData(synth_data);

    const source = off_ctx.createBufferSource();
    source.buffer = synth_buf;
    source.connect(off_ctx.destination);
    source.start((q.notes[1].ms_pos * 0.001) - (q.notes[0].frame_length / vml.frame_rate));


//    if(count !== 0) v.notes.unshift({ key: null, frame_length: 93, lyric: '' });
//    v.notes.push({ key: null, frame_length: 93, lyric: '' });
    // await sing(v, 3014, `./test_${count}.wav`);
//    if(count !== 0){
//      fs.copyFileSync('./concat.wav', './concat_copy.wav');
//      await concat_wav('./concat_copy.wav', `./test_${count}.wav`, './concat.wav');
//    }else{
//      fs.copyFileSync('./test_0.wav', './concat.wav');
//    }
//    sleep(1000);
//    console.log(`${count + 1}/${result.length} DONE`);
//    count++;
  }

  let buf = await off_ctx.startRendering();

  fs.writeFileSync('./test.wav', new Buffer.from(toWav(buf)), 'binary');
}

main();


