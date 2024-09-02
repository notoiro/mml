const copy = (obj) => JSON.parse(JSON.stringify(obj));

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

const blank_note = { key: null, lyric: '', octave: null, length: 1 };

class VML{
  constructor(frame_rate = 93.75){
    this.frame_rate = frame_rate;
  }

  parse(text){
    const sample = text.split(':');

    const lyrics = Array.from(sample[0]);
    const frames = sample[1].replace(/,/, "");

    return this._parse(frames, lyrics);
  }

  parse_voicevox(text, key_range_fix = 0){
    const song = this.parse(text);

    for(let s of song.track){
      s.length = this.calc_frame(this.calc_ms(s.length, song.tempo));
      s.key = this.note_to_midi(s.key, s.octave, key_range_fix);
    }

    song.track.unshift(blank_note);

    return song;
  }

  _parse(frames, lyrics){
    const frame_arr = Array.from(frames);

    const results = [];

    // C4, o4
    let octave = 4;
    let is_wait_octave = false;
    let is_wait_tempo= false;
    let current = null;
    let tempo = "120";

    for(let _f of frame_arr){
      let f = _f.toLowerCase();
      switch(true){
        // cdefgabが音程、rが休符、oがオクターブ、tがテンポ
        case /[cdefgabrot]/.test(f):
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
              key: f,
              lyric: lyrics.shift(),
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

  note_to_midi(note, octave, key_range_fix = 0){
    return note === null ? null :  (notes[note] + (octave + 1) * 12) + key_range_fix;
  }

  calc_ms(score_length, bpm = 120){
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

  calc_frame(ms){
    return Math.round(ms * this.frame_rate /1000);
  }
}

module.exports = VML;

//function main(){
//  const vml = new VML();
//
//  console.log(vml.parse_voicevox(process.argv[2], +7));
//}
//
//main();

