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

class MMLError extends Error{
  constructor(e){
    super(e);
    this.name = new.target.name;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    Object.setPrototypeOf(this, new.target.prototype);
  }
}

class MML{
  constructor(ppq){
    this.ppq = ppq;
  }

  parse_line(text, octave = 4){
    const frames = text.replace(/,/g, "");
    return this._parse(frames, octave);
  }

  parse(text){
    const result = [];

    let one = true;
    let tempo = 120;
    let octave = 4;

    let split_text = text.replace(/\n/g, '').split(';').filter(Boolean);

    let counter = 0;
    for(let l of split_text){
      let line;
      try{
        line = this.parse_line(l, octave);
      }catch(e){
        throw new MMLError(`Error in: LINE ${counter}, ${l}`);
      }

      if(one){
        tempo = line.tempo;
        one = false;
      }

      octave = line.last_octave;
      result.push(line.track);
      counter++;
    }

    return {
      tempo,
      tracks: result
    };
  }

  parse_midi(text){
    let song;
    try{
      song = this.parse(text);
    }catch(e){
      throw e;
    }

    let notes = [];
    let rest = 0;

    for(let t of song.tracks){
      for(let s of t){
        if(s.keys === null){
          rest += this.calc_tick(s.length, song.tempo);
        }else{
          let pitchs = [];
          for(let i = 0; i < s.keys.length; i++){
            pitchs.push(this.note_to_midi(s.keys[i], s.octaves[i]));
          }

          let wait = rest === 0 ? 0 : `T${rest}`;
          notes.push({
            pitch: pitchs,
            duration: `T${this.calc_tick(s.length, song.tempo)}`,
            wait
          });

          rest = 0;
        }
      }
    }

    song.tracks = notes;

    return song;
  }

  _parse(frames,init_octave = 4){
    const frame_arr = Array.from(frames);

    const results = [];

    // C4, o4
    let octave = init_octave;
    let is_wait_octave = false;
    let is_wait_tempo= false;
    let is_prev_not_key = true;
    let current = null;
    let tempo = "120";
    let last = null;

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

          if(is_prev_not_key){
            is_prev_not_key = false;
            results.push(copy(current));
            current = null;

            if(f === 'r'){
              current = {
                keys: null,
                octaves: null,
                length: ""
              };
            }else{
              current = {
                keys: [f],
                octaves: [octave],
                length: ""
              }
            }
          }else{
            current.keys.push(f);
            current.octaves.push(octave);
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
          is_prev_not_key = true;
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
          is_prev_not_key = true;
          break;
        case /[\+#]/.test(f):
          last = current.keys.pop() + "+";
          current.keys.push(last);
          break;
        case f === '-':
          last = current.keys.pop() + "-";
          current.keys.push(last);
          break;
      }
    }

    results.push(copy(current));
    results.shift();

    return {
      tempo: parseInt(tempo),
      track: results,
      last_octave: octave
    };
  }

  note_to_midi(note, octave){
    if(note == "e+") throw "e#";
    return note === null ? null :  (notes[note] + (octave + 1) * 12);
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

  calc_tick(length, bpm){
    const tick_length = 60/bpm/this.ppq*1000;
    return this.calc_ms(length, bpm)/tick_length;
  }
}

exports.MML = MML;
exports.MMLError = MMLError;

