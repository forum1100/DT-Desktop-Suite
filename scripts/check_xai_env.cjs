const v=process.env.XAI_API_KEY||'';
console.log(JSON.stringify({processPresent:Boolean(v),processLength:v.length}));
