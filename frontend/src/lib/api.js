export const API_BASE = window.location.origin;

export async function api(method,path,body,token){
  const opts={method,headers:{'Content-Type':'application/json'}};
  if(token) opts.headers['Authorization']='Bearer '+token;
  if(body) opts.body=JSON.stringify(body);
  const r=await fetch(API_BASE+'/api'+path,opts);
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.error||'Error '+r.status);
  return data;
}
