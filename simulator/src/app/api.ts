const prefix=(import.meta.env.VITE_HARVESTSHIELD_API_PREFIX??'/api').replace(/\/$/,'');
if(!/^\/(?!\/)[A-Za-z0-9/_-]+$/.test(prefix))throw new Error('API prefix must be a same-origin absolute path');
export const apiPath=(path:string)=>`${prefix}${path}`;
