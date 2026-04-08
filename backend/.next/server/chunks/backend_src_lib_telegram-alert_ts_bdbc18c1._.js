module.exports=[79861,e=>{"use strict";let t=[];function r(e){return e.replace(/([_*\[\]()~`>#+\-=|{}.!\\])/g,"\\$1")}let n={critical:"🔴",warning:"🟡",info:"🔵",success:"✅"},i={critical:"CRITICAL",warning:"WARNING",info:"INFO",success:"SUCCESS"};async function l(e){var l;let a,s,c=(a=process.env.TELEGRAM_BOT_TOKEN?.trim(),s=process.env.TELEGRAM_CHAT_ID?.trim(),a&&s?{token:a,chatId:s}:null);if(!c)return!1;if(!e.force&&function(){let e=Date.now();for(;t.length>0&&t[0]<e-6e4;)t.shift();return t.length>=30||(t.push(e),!1)}())return process.stderr.write(`[telegram-alert] Rate limited, dropping: ${e.title}
`),!1;let o=n[e.level],u=i[e.level],f=new Date().toISOString().replace("T"," ").replace(/\.\d+Z$/," UTC"),g=`${o} *${r(u)}* — ${r(e.title)}

`;if(g+=`${r(e.message)}
`,e.meta&&Object.keys(e.meta).length>0)for(let[t,n]of(g+="\n",Object.entries(e.meta)))null!=n&&(g+=`• *${r(t)}*: \`${r(String(n))}\`
`);g+=`
🕐 ${r(f)}`,g+=`
🏷 ${r("PrecisionAI")}`,g=(l=g).length<=4e3?l:l.slice(0,3980)+"\n\n… (truncado)";try{let e=`https://api.telegram.org/bot${c.token}/sendMessage`,t=await fetch(e,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:c.chatId,text:g,parse_mode:"MarkdownV2",disable_web_page_preview:!0}),signal:AbortSignal.timeout(1e4)});if(!t.ok){let e=await t.text().catch(()=>"");return process.stderr.write(`[telegram-alert] API error ${t.status}: ${e}
`),!1}return!0}catch(e){return process.stderr.write(`[telegram-alert] Send failed: ${e instanceof Error?e.message:"Unknown"}
`),!1}}function a(e,t,r){return l({level:"critical",title:e,message:t,meta:r,force:!0})}function s(e,t,r){return l({level:"warning",title:e,message:t,meta:r})}function c(e,t,r){return l({level:"info",title:e,message:t,meta:r})}function o(e,t,r){return l({level:"success",title:e,message:t,meta:r})}e.s(["alertCritical",()=>a,"alertInfo",()=>c,"alertSuccess",()=>o,"alertWarning",()=>s,"sendTelegramAlert",()=>l])}];

//# sourceMappingURL=backend_src_lib_telegram-alert_ts_bdbc18c1._.js.map