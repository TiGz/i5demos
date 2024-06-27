import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("Initializing environment variables");

const region = Deno.env.get("AWS_REGION");
const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID");
const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY");
const bucketName = Deno.env.get("S3_BUCKET_NAME");

if (!region || !accessKeyId || !secretAccessKey || !bucketName) {
  console.error("Missing required environment variables");
  Deno.exit(1);
}

const s3Endpoint = `https://${bucketName}.s3.${region}.amazonaws.com`;

console.log(`S3 Bucket: ${bucketName}`);
console.log(`S3 Endpoint: ${s3Endpoint}`);

interface FileUploadRequest {
  folder: string;
  filename: string;
  data: string;
  mime_type: string;
  type?: "base64";
}

function toHexString(byteArray: Uint8Array): string {
  return Array.from(byteArray, (byte) => {
    return ('0' + (byte & 0xFF).toString(16)).slice(-2);
  }).join('');
}

async function hmacSha256(key: ArrayBuffer, message: string): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
}

async function getSignatureKey(key: string, dateStamp: string, regionName: string, serviceName: string): Promise<ArrayBuffer> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${key}`), dateStamp);
  const kRegion = await hmacSha256(kDate, regionName);
  const kService = await hmacSha256(kRegion, serviceName);
  return hmacSha256(kService, "aws4_request");
}

async function sha256(message: string | ArrayBuffer): Promise<string> {
  let msgBuffer: ArrayBuffer;
  if (typeof message === 'string') {
    msgBuffer = new TextEncoder().encode(message);
  } else {
    msgBuffer = message;
  }
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  return toHexString(new Uint8Array(hashBuffer));
}

async function signRequest(method: string, path: string, query: string, headers: Record<string, string | number | boolean>, body: string | ArrayBuffer): Promise<Record<string, string>> {
  const algorithm = "AWS4-HMAC-SHA256";
  const service = "s3";
  const amzDate = new Date().toISOString().replace(/[:\-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);

  const canonicalUri = path;
  const canonicalQueryString = query;
  
  const payloadHash = await sha256(body);
  
  headers["x-amz-content-sha256"] = payloadHash;
  headers["x-amz-date"] = amzDate;

  const canonicalHeaders = Object.entries(headers)
    .sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    .map(([k, v]) => `${k.toLowerCase()}:${String(v).trim()}`)
    .join("\n") + "\n";

  const signedHeaders = Object.keys(headers)
    .map(k => k.toLowerCase())
    .sort()
    .join(";");

  const canonicalRequest = [method, canonicalUri, canonicalQueryString, canonicalHeaders, signedHeaders, payloadHash].join("\n");

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [algorithm, amzDate, credentialScope, await sha256(canonicalRequest)].join("\n");

  const signingKey = await getSignatureKey(secretAccessKey, dateStamp, region, service);
  const signature = toHexString(new Uint8Array(await hmacSha256(signingKey, stringToSign)));

  const authorizationHeader = `${algorithm} Credential=${accessKeyId}/${credentialScope},SignedHeaders=${signedHeaders},Signature=${signature}`;

  console.log("Authorization Header:", authorizationHeader);

  return {
    "Authorization": authorizationHeader,
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
  };
}

async function uploadToS3(key: string, content: string | ArrayBuffer, contentType: string): Promise<Response> {
  const path = `/${key}`;
  const url = `${s3Endpoint}${path}`;
  const headers = {
    "Host": new URL(s3Endpoint).host,
    "Content-Type": contentType,
    "x-amz-acl": "public-read",
  };
  const authHeaders = await signRequest("PUT", path, "", headers, content);

  console.log("Upload URL:", url);
  console.log("Upload Headers:", { ...headers, ...authHeaders });

  const response = await fetch(url, {
    method: "PUT",
    headers: { ...headers, ...authHeaders },
    body: content,
  });

  if (!response.ok) {
    console.error(`Failed to upload file: ${response.statusText}`);
    console.error(`Response body: ${await response.text()}`);
    throw new Error(`Failed to upload file: ${response.statusText}`);
  }

  return response;
}

async function handleFileUpload(req: FileUploadRequest): Promise<Response> {
  console.log("Handling file upload request");
  console.log(`Request details: ${JSON.stringify(req, null, 2)}`);

  const { folder, filename, data, mime_type, type } = req;
  const key = `${folder}/${filename}`;

  console.log(`File key: ${key}`);

  try {
    let content: string | ArrayBuffer = data;
    if (type === "base64") {
      content = Uint8Array.from(atob(data), c => c.charCodeAt(0)).buffer;
    }

    console.log("Initiating file upload");
    await uploadToS3(key, content, mime_type);

    const fileUrl = `${s3Endpoint}/${key}`;
    console.log(`File URL: ${fileUrl}`);

    console.log("Preparing success response");
    return new Response(JSON.stringify({ url: fileUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(`Error during file upload: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return new Response(JSON.stringify({ error: "Failed to upload file", details: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

console.log("Setting up HTTP server");
serve(async (req) => {
  console.log(`Received ${req.method} request`);
  if (req.method === "POST") {
    try {
      console.log("Parsing request body");
      const body: FileUploadRequest = await req.json();
      console.log("Request body parsed successfully");
      return await handleFileUpload(body);
    } catch (error) {
      console.error(`Error parsing request body: ${error.message}`);
      return new Response(JSON.stringify({ error: "Invalid JSON input", details: error.message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.log(`Unsupported method: ${req.method}`);
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("Server is ready to handle requests");