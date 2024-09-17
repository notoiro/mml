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

class VML{
  constructor(frame_rate = 93.75){
    this.frame_rate = frame_rate;
  }

  parse_line(text, octave = 4){
    const sample = text.split(':');

    const lyrics = Array.from(sample[0]);
    const frames = sample[1].replace(/,/g, "");

    return this._parse(frames, lyrics, octave);
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
        throw `Error in: LINE ${counter}, ${l}`;
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

  parse_voicevox(text, key_range_fix = 0){
    let song;
    try{
      song = this.parse(text);
    }catch(e){
      throw e;
    }

    // 固定で1小節
    song.tracks[0].unshift({ key: null, lyric: "", octave: null, length: "1" });

    let tracks = [];
    let time = 0;
    let ms_time = 0;

    for(let t of song.tracks){
      for(let s of t){
        let ms = this.calc_ms(s.length, song.tempo);
        let frame_length = this.calc_frame(ms);
        if(s.key !== null){
          tracks.push({
            key: this.note_to_midi(s.key, s.octave, key_range_fix),
            lyric: s.lyric,
            frame_length,
            pos: time,
            ms_pos: ms_time,
            ms
          });
        }
        time += frame_length;
        ms_time += ms;
      }
    }

    let result = [];
    let current_arr = {
      distance: this.calc_frame(this.calc_ms('1', song.tempo)),
      notes: []
    };

    for(let i = 0; i < tracks.length; i++){
      let next = i + 1;
      let current = tracks[i];

      current_arr.notes.push(current);

      if((next < tracks.length) && (tracks[next].pos !== (current.pos + current.frame_length))){
        result.push(current_arr);
        current_arr = {
          distance: tracks[next].pos - (current.pos + current.frame_length),
          notes: []
        };
      }
    }

    result.push(current_arr);

    song.tracks = result;

    return song;
  }

  _parse(frames, lyrics, init_octave = 4){
    const frame_arr = Array.from(frames);

    const results = [];

    // C4, o4
    let octave = init_octave;
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
      track: results,
      last_octave: octave
    };
  }

  note_to_midi(note, octave, key_range_fix = 0){
    if(note == "e+") throw "e+";
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

