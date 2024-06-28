import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

console.log("Initializing environment variables");

const clickSendApiUsername = Deno.env.get("CLICK_SEND_API_USERNAME");
const clickSendApiKey = Deno.env.get("CLICK_SEND_API_KEY");
const emailAddressId = Deno.env.get("CLICK_SEND_EMAIL_ADDRESS_ID") || "0";

if (!clickSendApiUsername || !clickSendApiKey) {
  console.error("Missing required environment variables");
  Deno.exit(1);
}

console.log("ClickSend credentials loaded");
console.log(`Using email address ID: ${emailAddressId}`);

interface EmailRecipient {
  email: string;
  name: string;
}

interface EmailAttachment {
  content: string;
  type: string;
  filename: string;
  disposition: string;
  content_id: string;
}

interface EmailRequest {
  to: EmailRecipient[];
  from: string;
  subject: string;
  body: string;
  attachments?: EmailAttachment[];
}

async function sendEmail(req: EmailRequest): Promise<Response> {
  const { to, from, subject, body, attachments } = req;

  if (!to || !from || !subject || !body) {
    throw new Error("Missing required fields (to, from, subject, body)");
  }

  const endpoint = 'https://rest.clicksend.com/v3/email/send';
  const payload = JSON.stringify({
    to,
    from: {
      email_address_id: parseInt(emailAddressId),
      name: from
    },
    subject,
    body,
    attachments: attachments || []
  });

  const authString = base64Encode(`${clickSendApiUsername}:${clickSendApiKey}`);

  console.log("Sending request to ClickSend:");
  console.log(`URL: ${endpoint}`);
  console.log("Headers:", {
    'Authorization': `Basic ${authString.substring(0, 10)}...`, // Only show part of the auth string
    'Content-Type': 'application/json'
  });
  console.log("Payload:", payload);

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${authString}`,
      'Content-Type': 'application/json'
    },
    body: payload
  });

  return response;
}

async function handleEmailRequest(req: EmailRequest): Promise<Response> {
  console.log("Handling Email request");
  console.log(`Request details: ${JSON.stringify(req, null, 2)}`);

  try {
    const response = await sendEmail(req);
    const responseBody = await response.text();
    console.log(`ClickSend API Response:`);
    console.log(`Status: ${response.status}`);
    console.log(`Headers: ${JSON.stringify(Object.fromEntries(response.headers), null, 2)}`);
    console.log(`Body: ${responseBody}`);

    if (response.ok) {
      console.log("Preparing success response");
      return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Error sending Email: ClickSend API returned non-200 status code");
      return new Response(JSON.stringify({ success: false, error: "Failed to send Email" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error(`Error sending Email: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return new Response(JSON.stringify({ success: false, error: "Failed to send Email" }), {
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
      const body: EmailRequest = await req.json();
      console.log("Request body parsed successfully");
      return await handleEmailRequest(body);
    } catch (error) {
      console.error(`Error parsing request body: ${error.message}`);
      return new Response(JSON.stringify({ success: false, error: "Invalid JSON input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
  } else {
    console.log(`Unsupported method: ${req.method}`);
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }
});

console.log("Server is ready to handle requests");