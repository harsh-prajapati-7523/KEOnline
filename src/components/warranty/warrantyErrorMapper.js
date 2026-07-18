const known=[
  [/updated by another|stale|version/i,"This warranty record changed while you were editing."],
  [/owner.*required/i,"Assign a person responsible before continuing."],
  [/complaint.*number.*required/i,"Enter the manufacturer complaint number."],
  [/expected visit.*required/i,"Choose when the manufacturer engineer is expected."],
  [/follow-up.*future|next follow-up.*future/i,"Choose today or a future follow-up date."],
  [/workflow.*(not configured|missing|ambiguous)|action configuration/i,"This action is not configured for the ticket’s current workflow."],
  [/corrections must supersede|identity.*supersede/i,"Use Correct Replacement Record to change the product, model, serial number, or reference."],
  [/claim is not editable|action is no longer|result is already final/i,"This action is no longer available for the warranty’s current stage."],
];

export function mapWarrantyError(error){
 const raw=typeof error==="string"?error:error?.message||"";
 const mapped=known.find(([pattern])=>pattern.test(raw));
 if(mapped)return {message:mapped[1],conflict:Boolean(error?.status===409||/changed while/.test(mapped[1])),fieldErrors:error?.fieldErrors||{}};
 if(error?.name==="TypeError"||/failed to fetch|network/i.test(raw))return {message:"We couldn’t reach the server. Check your connection and try again.",network:true,fieldErrors:{}};
 return {message:raw&&raw.length<300?raw:"We couldn’t save this warranty update. Review the form and try again.",conflict:error?.status===409,fieldErrors:error?.fieldErrors||{}};
}
