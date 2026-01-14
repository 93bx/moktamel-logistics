import { getRequestConfig } from "next-intl/server";
import { defaultLocale, isLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const locale = (await requestLocale) || defaultLocale;
  const resolved = isLocale(locale) ? locale : defaultLocale;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'i18n/request.ts:5',message:'Request config locale resolution',data:{requestLocale:locale,resolved,defaultLocale},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion

  const messages = (await import(`../../messages/${resolved}.json`)).default;

  // #region agent log
  fetch('http://127.0.0.1:7243/ingest/bfa58f2a-7ab1-463f-905a-0dfca7fc2a75',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'i18n/request.ts:11',message:'Request config messages loaded',data:{resolved,messageKeys:Object.keys(messages),sampleMessage:JSON.stringify(messages.app||{}).substring(0,100)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
  // #endregion

  return {
    locale: resolved,
    messages,
  };
});


