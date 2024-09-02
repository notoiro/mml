const sample = process.argv[2].split(':');

const notes = {
  'c':  0,
  'c+': 1, 'd-':  1,
  'd':  2,
  'd+': 3, 'e-':  3,
  'e':  4,
  'f':  5,
  'f+': 6, 'g-':  6,
  'g':  7,
  'g+': 8, 'a-':  8,
  'a':  9,
  'a+': 10, 'b-': 10,
  'b': 11
}

function main(){
  const lyrics = Array.from(sample[0]);
  const frames = sample[1].replace(/,/, "");

  const song = parse(frames, lyrics);

  for(let s of song.track){
    s.frame = calc_frame(calc_ms(s.length, song.tempo));
    s.key = note_to_midi(s.key, s.octave) + 7;
  }

  console.log(song);
}

function parse(frames, lyrics){
  const frame_arr = Array.from(frames);

  const results = [];

  // C4, o4
  let octave = 4;
  let is_wait_octave = false;
  let is_wait_tempo= false;
  let current = null;
  let tempo = "120";

  for(let f of frame_arr){
    switch(true){
      // cdefgabが音程、rが休符、oがオクターブ、tがテンポ
      case /[cdefgabrot]/i.test(f):
        is_wait_octave = false;
        is_wait_tempo = false;
        if(f === 'o'){
          is_wait_octave = true;
          continue;
        }

        if(f === 't'){
          is_wait_tempo = true;
          tempo = "";
          continue;
        }

        results.push(copy(current));
        current = null;

        if(f === 'r'){
          current = {
            key: null,
            lyric: "",
            octave: null,
            length: ""
          };
        }else{
          current = {
            key: f.toLowerCase(),
            lyrics: lyrics.shift(),
            octave: octave,
            length: ""
          }
        }

        break;
      case f === '<':
        octave--;
        break;
      case f === '>':
        octave++;
        break;
      case f === '.':
        current.length += '.';
        break;
      case f === '^':
        current.length += '^';
        break;
      case /[0-9]/.test(f):
        if(is_wait_octave){
          octave = parseInt(f);
          continue;
        }

        if(is_wait_tempo){
          tempo += f;
          continue;
        }

        current.length += f;
        break;
      case /[\+#]/.test(f):
        current.key += "+";
        break;
      case f === '-':
        current.key += "-";
        break;
    }
  }

  results.push(copy(current));
  results.shift();

  return {
    tempo: parseInt(tempo),
    track: results
  };
}

function note_to_midi(note, octave){
  return note === null ? null :  notes[note] + (octave + 1) * 12;
}

function calc_ms(score_length, bpm = 120){
  let result = 0;

  for(let s of score_length.split('^')){
    let length;
    let dot = false;

    if(s.includes('.')){
      length = parseInt(s.replace('.', ''), 10);
      dot = true;
    }else{
      length = parseInt(s, 10);
    }

    let ms = 240/bpm/length*1000;

    if(dot) ms = ms * 1.5;

    result += ms;
  }
  return result;
}

function calc_frame(ms, frame_rate = 93.75){
  return Math.round(ms * frame_rate /1000);
}

function copy(obj){
  return JSON.parse(JSON.stringify(obj));
}

main();
