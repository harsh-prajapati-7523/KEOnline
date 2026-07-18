export const required=(value,message)=>String(value??"").trim()?null:message;
export const todayOrFuture=(value,message)=>value&&value<new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Kolkata"})?message:null;
export function focusFirstError(formElement,errors){
 const first=Object.keys(errors).find(key=>errors[key]);
 if(!first)return;
 const field=formElement?.elements?.namedItem(first);
 field?.focus?.();field?.scrollIntoView?.({block:"center",behavior:"smooth"});
}
