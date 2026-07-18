import { useCallback, useMemo, useState } from "react";
import { mapWarrantyError } from "./warrantyErrorMapper";

export default function useWarrantyActionForm(initialValues,validator=()=>({})){
 const[values,setValues]=useState(initialValues),[fieldErrors,setFieldErrors]=useState({}),[formError,setFormError]=useState(""),[isSubmitting,setIsSubmitting]=useState(false),[conflict,setConflict]=useState(false);
 const initial=useMemo(()=>JSON.stringify(initialValues),[initialValues]);
 const isDirty=JSON.stringify(values)!==initial;
 const setFieldValue=useCallback((name,value)=>{setValues(current=>({...current,[name]:value}));setFieldErrors(current=>({...current,[name]:undefined}));setFormError("");},[]);
 const validate=useCallback(()=>{const errors=validator(values);setFieldErrors(errors);return errors;},[validator,values]);
 const handleError=useCallback(error=>{const mapped=mapWarrantyError(error);setFormError(mapped.message);setConflict(Boolean(mapped.conflict));setFieldErrors(current=>({...current,...mapped.fieldErrors}));return mapped;},[]);
 const reset=useCallback(next=>{setValues(next||initialValues);setFieldErrors({});setFormError("");setConflict(false);},[initialValues]);
 return {values,fieldErrors,formError,isDirty,isSubmitting,conflict,setFieldValue,setFieldError:(name,message)=>setFieldErrors(current=>({...current,[name]:message})),setFormError,setIsSubmitting,setConflict,validate,handleError,reset};
}
