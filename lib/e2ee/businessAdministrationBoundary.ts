import {
  decryptBusinessPayload,
  encryptBusinessPayload,
  type BusinessCiphertextEnvelopeV1,
} from "@/lib/e2ee/businessVault";

const MAGIC = new TextEncoder().encode("FICONTER-BIZDOC-V1\0");
const IV_BYTES = 12;

type PendingDocument = { id:string; name:string; mime:string; size:number; storagePath:string };
type State = { businessKey: CryptoKey; businessId: string; pendingDocuments: Map<string,PendingDocument> };
const toBuffer = (bytes: Uint8Array) => { const copy=new Uint8Array(bytes.byteLength);copy.set(bytes);return copy.buffer; };
const aad = (businessId:string,documentId:string) => new TextEncoder().encode(`ficonter:business-document-file:${businessId}:${documentId}:v1`);
function docIdFromPath(path:string) {
  const parts=path.split("/").filter(Boolean);
  const last=parts.at(-1) ?? "";
  if(last.endsWith(".ficonter")) return last.slice(0,-".ficonter".length);
  return parts.at(-2) ?? "";
}
function opaqueDocumentPath(path:string,businessId:string,documentId:string) {
  const parts=path.split("/").filter(Boolean);
  const owner=parts[0] ?? "vault";
  return `${owner}/${businessId}/${documentId}.ficonter`;
}

async function encryptFile(key:CryptoKey,businessId:string,documentId:string,file:File){
  const iv=crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const source=new Uint8Array(await file.arrayBuffer());
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv:toBuffer(iv),additionalData:toBuffer(aad(businessId,documentId))},key,toBuffer(source)));
  const output=new Uint8Array(MAGIC.length+iv.length+ciphertext.length);output.set(MAGIC);output.set(iv,MAGIC.length);output.set(ciphertext,MAGIC.length+iv.length);
  return new Blob([output],{type:"application/octet-stream"});
}
async function decryptFile(key:CryptoKey,businessId:string,documentId:string,encrypted:ArrayBuffer){
  const bytes=new Uint8Array(encrypted); if(bytes.length<MAGIC.length+IV_BYTES+16) throw new Error("Encrypted business document is incomplete.");
  for(let i=0;i<MAGIC.length;i++) if(bytes[i]!==MAGIC[i]) throw new Error("Unsupported encrypted business document format.");
  const iv=bytes.slice(MAGIC.length,MAGIC.length+IV_BYTES);const ciphertext=bytes.slice(MAGIC.length+IV_BYTES);
  return crypto.subtle.decrypt({name:"AES-GCM",iv:toBuffer(iv),additionalData:toBuffer(aad(businessId,documentId))},key,toBuffer(ciphertext));
}
async function openPayload(state:State,type:string,id:string,row:any){
  if(!row?.encrypted_payload || row.encryption_version!==1) return row;
  return {...row,...await decryptBusinessPayload(state.businessKey,state.businessId,type,id,row.encrypted_payload as BusinessCiphertextEnvelopeV1)};
}

export function installBusinessAdministrationBoundary(client:any,businessKey:CryptoKey,businessId:string){
  const raw=client as any; const existing=raw.__ficonterBusinessAdministrationBoundary as State|undefined;
  if(existing){existing.businessKey=businessKey;existing.businessId=businessId;return;}
  const state:State={businessKey,businessId,pendingDocuments:new Map()}; raw.__ficonterBusinessAdministrationBoundary=state;
  const originalRpc=raw.rpc.bind(raw); const originalFrom=raw.from.bind(raw); const originalStorageFrom=raw.storage.from.bind(raw.storage);

  raw.rpc=(fn:string,args?:Record<string,unknown>,options?:unknown)=>{
    if(!["update_business_workspace","update_business_administration_settings","create_business_document","update_business_document","delete_business_document"].includes(fn)) return originalRpc(fn,args,options);
    return (async()=>{
      try{
        if(fn==="update_business_workspace"){
          const current=await originalFrom("businesses").select("*").eq("id",state.businessId).single(); if(current.error) return current;
          const encrypted=await encryptBusinessPayload(state.businessKey,state.businessId,"business-profile",state.businessId,{
            legal_name:args?.p_legal_name??null,tax_id:args?.p_tax_id??null,contact_email:args?.p_contact_email??null,contact_phone:args?.p_contact_phone??null,
            website:args?.p_website??null,address_line1:args?.p_address_line1??null,address_line2:args?.p_address_line2??null,city:args?.p_city??null,postal_code:args?.p_postal_code??null,
          });
          const result=await originalRpc("update_business_workspace_e2ee",{p_business_id:state.businessId,p_name:args?.p_name,p_business_type:args?.p_business_type,p_country_code:args?.p_country_code,p_base_currency:args?.p_base_currency,p_fiscal_year_start_month:args?.p_fiscal_year_start_month,p_timezone:args?.p_timezone,p_logo_path:args?.p_logo_path??null,p_cover_image_path:args?.p_cover_image_path??null,p_encrypted_payload:encrypted,p_expected_revision:Number(current.data?.e2ee_revision??0)});
          if(result.error||!result.data)return result; return {data:await openPayload(state,"business-profile",state.businessId,result.data),error:null};
        }
        if(fn==="update_business_administration_settings"){
          const current=await originalFrom("business_settings").select("*").eq("business_id",state.businessId).maybeSingle(); if(current.error)return current;
          const encrypted=await encryptBusinessPayload(state.businessKey,state.businessId,"business-settings",state.businessId,{
            default_timezone:args?.p_default_timezone??"UTC",date_format:args?.p_date_format??"DD/MM/YYYY",number_format:args?.p_number_format??"de-DE",
            default_payment_method:args?.p_default_payment_method??"Card",default_payment_terms_days:Number(args?.p_default_payment_terms_days??14),default_sales_tax_rate:Number(args?.p_default_sales_tax_rate??0),invoice_prefix:args?.p_invoice_prefix??"INV",next_invoice_number:Number(args?.p_next_invoice_number??1),default_low_stock_threshold:Number(args?.p_default_low_stock_threshold??0),
          });
          const result=await originalRpc("update_business_administration_settings_e2ee",{p_business_id:state.businessId,p_encrypted_payload:encrypted,p_expected_revision:Number(current.data?.e2ee_revision??0)}); if(result.error||!result.data)return result; return {data:await openPayload(state,"business-settings",state.businessId,result.data),error:null};
        }
        if(fn==="create_business_document"){
          const id=String(args?.p_document_id??""); const pending=state.pendingDocuments.get(id);
          if(!pending) throw new Error("Encrypted business document upload was not prepared.");
          const encrypted=await encryptBusinessPayload(state.businessKey,state.businessId,"document",id,{title:args?.p_title??"",category:args?.p_category??"Other",description:args?.p_description??null,original_filename:args?.p_original_filename??pending.name,mime_type:args?.p_mime_type??pending.mime,file_size:Number(args?.p_file_size??pending.size),expires_on:args?.p_expires_on??null});
          const result=await originalRpc("create_business_document_e2ee",{p_document_id:id,p_business_id:state.businessId,p_file_path:pending.storagePath,p_ciphertext_size:pending.size+MAGIC.length+IV_BYTES+16,p_encrypted_payload:encrypted}); if(result.error||!result.data)return result; state.pendingDocuments.delete(id); return {data:await openPayload(state,"document",id,result.data),error:null};
        }
        if(fn==="update_business_document"){
          const id=String(args?.p_document_id??""); const current=await originalFrom("business_documents").select("*").eq("id",id).eq("business_id",state.businessId).single(); if(current.error)return current; const opened=await openPayload(state,"document",id,current.data);
          const encrypted=await encryptBusinessPayload(state.businessKey,state.businessId,"document",id,{title:args?.p_title??opened.title,category:args?.p_category??opened.category,description:args?.p_description??null,original_filename:opened.original_filename,mime_type:opened.mime_type,file_size:Number(opened.file_size??0),expires_on:args?.p_expires_on??null});
          const result=await originalRpc("update_business_document_e2ee",{p_document_id:id,p_encrypted_payload:encrypted,p_expected_revision:Number(current.data.e2ee_revision??0)}); if(result.error||!result.data)return result; return {data:await openPayload(state,"document",id,result.data),error:null};
        }
        return originalRpc("delete_business_document_e2ee",{p_document_id:args?.p_document_id});
      }catch(caught){return {data:null,error:caught instanceof Error?caught:new Error("Encrypted business administration operation failed.")};}
    })();
  };

  raw.storage.from=(bucket:string)=>{
    const storage=originalStorageFrom(bucket); if(bucket!=="business-documents") return storage;
    const originalUpload=storage.upload.bind(storage); const originalSigned=storage.createSignedUrl.bind(storage);
    storage.upload=async(path:string,file:File,opts?:any)=>{
      const id=docIdFromPath(path);if(!id)return {data:null,error:new Error("Business document path is invalid.")};
      const storagePath=opaqueDocumentPath(path,state.businessId,id);
      state.pendingDocuments.set(id,{id,name:file.name,mime:file.type||"application/octet-stream",size:file.size,storagePath});
      const encrypted=await encryptFile(state.businessKey,state.businessId,id,file);
      return originalUpload(storagePath,encrypted,{...opts,contentType:"application/octet-stream"});
    };
    storage.createSignedUrl=async(path:string,expires:number,opts?:any)=>{const id=docIdFromPath(path);const signed=await originalSigned(path,expires);if(signed.error||!signed.data?.signedUrl)return signed;const response=await fetch(signed.data.signedUrl);if(!response.ok)return {data:null,error:new Error("Encrypted business document could not be downloaded.")};const plaintext=await decryptFile(state.businessKey,state.businessId,id,await response.arrayBuffer());const row=await originalFrom("business_documents").select("*").eq("id",id).eq("business_id",state.businessId).maybeSingle();let mime="application/octet-stream",name="document";if(row.data){const opened=await openPayload(state,"document",id,row.data);mime=opened.mime_type??mime;name=opened.original_filename??name;}const url=URL.createObjectURL(new Blob([plaintext],{type:mime}));window.setTimeout(()=>URL.revokeObjectURL(url),120000);return {data:{signedUrl:url,path,download:opts?.download??name},error:null};};
    return storage;
  };
}
