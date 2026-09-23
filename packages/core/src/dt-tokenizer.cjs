const fs = require('node:fs');
const crypto = require('node:crypto');

const DT_SPECIAL_TOKENS = Object.freeze([
  '<PAD>','<UNK>','<BOS>','<EOS>',
  '<PREDICTION>','<EXECUTION>','<VALIDATION>','<RESIDUAL>',
  '<DERIVATIVE>','<BRANCH>','<PERCEPTION_POINT>','<OPERATIONAL_CONTACT>',
  '<SOURCE>','<PROVENANCE>','<FAILURE>','<CORRECTION>','<MEMORY>','<TOOL_EVENT>'
]);

const ARCHIVE_ENCODING = 'o200k_base';
const ARCHIVE_VOCAB_SHA256 = '446a9538cb6c348e3516120d7c08b09f57c36495e2acfffe59a5bf8b0cfb1a2d';
const GEN1_LOCK = Object.freeze({
  sourceSha256:'505e10c599675bf4b4420ea188f2a36bd897e35d6ebe25a3db7ae44c90648476',
  sourceBytes:69039010, conversations:169, currentMessages:9440,
  currentUserTokens:166433, currentAssistantTokens:2455788,
  currentTokens:2622221, allBranchTokens:2701878, alternateBranchDelta:79657
});

const digest = value => crypto.createHash('sha256').update(Buffer.isBuffer(value) ? value : String(value)).digest('hex');
function splitSpecials(text) {
  const escaped = DT_SPECIAL_TOKENS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'));
  const re = new RegExp('(' + escaped.join('|') + ')','g');
  return String(text || '').split(re).filter(Boolean);
}

class DTNativeTokenizer {
  constructor(config = {}) {
    this.specials = DT_SPECIAL_TOKENS;
    this.specialToId = new Map(this.specials.map((t,i)=>[t,i]));
    this.byteOffset = this.specials.length;
    this.merges = Array.isArray(config.merges) ? config.merges : [];
    this.version = config.version || 'DT_NATIVE_TOKENIZER_1.0';
    this.mergeMap = new Map(this.merges.map((pair,i)=>[pair.join(','), this.byteOffset + 256 + i]));
    this.idToMerge = new Map(this.merges.map((pair,i)=>[this.byteOffset + 256 + i, pair]));
  }

  baseEncode(text) {
    const ids = [];
    for (const part of splitSpecials(text)) {
      if (this.specialToId.has(part)) { ids.push(this.specialToId.get(part)); continue; }
      for (const byte of Buffer.from(part,'utf8')) ids.push(this.byteOffset + byte);
    }
    return ids;
  }

  encode(text) {
    let ids = this.baseEncode(text);
    for (let m=0; m<this.merges.length; m++) {
      const pair = this.merges[m], merged = this.byteOffset + 256 + m, next=[];
      for (let i=0;i<ids.length;i++) {
        if (i+1<ids.length && ids[i]===pair[0] && ids[i+1]===pair[1]) { next.push(merged); i++; }
        else next.push(ids[i]);
      }
      ids = next;
    }
    return ids;
  }
  expandId(id, out=[]) {
    if (id < this.specials.length) { out.push({special:this.specials[id]}); return out; }
    if (id < this.byteOffset + 256) { out.push({byte:id-this.byteOffset}); return out; }
    const pair = this.idToMerge.get(id); if (!pair) { out.push({special:'<UNK>'}); return out; }
    this.expandId(pair[0],out); this.expandId(pair[1],out); return out;
  }

  decode(ids) {
    const chunks=[]; let bytes=[];
    const flush=()=>{ if(bytes.length){ chunks.push(Buffer.from(bytes).toString('utf8')); bytes=[]; } };
    for(const id of ids||[]) {
      for(const atom of this.expandId(Number(id),[])) {
        if(atom.special){ flush(); chunks.push(atom.special); }
        else bytes.push(atom.byte);
      }
    }
    flush(); return chunks.join('');
  }

  count(text) { return this.encode(text).length; }
  config() {
    const body={schema:'dt-tokenizer/1.0',version:this.version,specialTokens:[...this.specials],byteOffset:this.byteOffset,merges:this.merges};
    return {...body,configHash:digest(JSON.stringify(body))};
  }
  save(file){ fs.writeFileSync(file,JSON.stringify(this.config(),null,2),'utf8'); return this.config(); }
  static load(file){ return new DTNativeTokenizer(JSON.parse(fs.readFileSync(file,'utf8'))); }
}

function pairCounts(sequences) {
  const counts=new Map();
  for(const seq of sequences) for(let i=0;i+1<seq.length;i++) {
    if (seq[i] < DT_SPECIAL_TOKENS.length || seq[i+1] < DT_SPECIAL_TOKENS.length) continue;
    const key=seq[i]+','+seq[i+1]; counts.set(key,(counts.get(key)||0)+1);
  }
  return counts;
}
function trainDTTokenizer(texts, options={}) {
  const target=Math.max(DT_SPECIAL_TOKENS.length+256, Number(options.vocabSize)||4096);
  const minFrequency=Math.max(2,Number(options.minPairFrequency)||2);
  const tokenizer=new DTNativeTokenizer(); let sequences=(texts||[]).map(t=>tokenizer.baseEncode(t));
  const merges=[];
  while(DT_SPECIAL_TOKENS.length+256+merges.length<target) {
    const counts=pairCounts(sequences); let best=null,bestCount=0;
    for(const [key,count] of counts) if(count>bestCount){best=key;bestCount=count;}
    if(!best||bestCount<minFrequency) break;
    const pair=best.split(',').map(Number), merged=DT_SPECIAL_TOKENS.length+256+merges.length;
    merges.push(pair);
    sequences=sequences.map(seq=>{const out=[];for(let i=0;i<seq.length;i++){
      if(i+1<seq.length&&seq[i]===pair[0]&&seq[i+1]===pair[1]){out.push(merged);i++;}else out.push(seq[i]);}return out;});
  }
  return new DTNativeTokenizer({merges,version:'DT_NATIVE_TOKENIZER_1.0'});
}

function archiveCompatibilityContract() {
  return {
    schema:'dt-chatgpt-archive-tokenizer-contract/1.0', encoding:ARCHIVE_ENCODING,
    officialVocabularySha256:ARCHIVE_VOCAB_SHA256, generation1Lock:GEN1_LOCK,
    measurementBoundary:'visible user/assistant/tool textual content; hidden reasoning and attachment pixels excluded',
    approximationPermitted:false, bytesDivFourFallback:false,
    exactCountRule:'Use installed tiktoken o200k_base or hash-verified official vocabulary only.',
    structuralParseMaySubstituteForExactCount:false
  };
}

module.exports={DT_SPECIAL_TOKENS,DTNativeTokenizer,trainDTTokenizer,archiveCompatibilityContract,ARCHIVE_VOCAB_SHA256,GEN1_LOCK,digest};
