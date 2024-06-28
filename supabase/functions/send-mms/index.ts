import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { encode as base64Encode } from "https://deno.land/std@0.177.0/encoding/base64.ts";

console.log("Initializing environment variables");

const clickSendApiUsername = Deno.env.get("CLICK_SEND_API_USERNAME");
const clickSendApiKey = Deno.env.get("CLICK_SEND_API_KEY");

if (!clickSendApiUsername || !clickSendApiKey) {
  console.error("Missing required environment variables");
  Deno.exit(1);
}

console.log("ClickSend credentials loaded");

interface MMSRequest {
  subject: string;
  from: string;
  to: string;
  body: string;
  media_file: string;
}

function formatPhoneNumber(phoneNumber: string): string {
  if (!phoneNumber) {
    throw new Error("Phone number is required");
  }
  // Remove any non-digit characters
  const digits = phoneNumber.replace(/\D/g, '');

  // If the number doesn't start with a '+', assume it's a UK number
  if (!phoneNumber.startsWith('+')) {
    // If it starts with '0', replace it with '+44'
    if (digits.startsWith('0')) {
      return '+44' + digits.slice(1);
    }
    // If it doesn't start with '0', add '+44'
    return '+44' + digits;
  }

  // If it already starts with a '+', just return the digits with the '+'
  return '+' + digits;
}

async function sendMMS(req: MMSRequest): Promise<Response> {
  const { subject, from, to, body, media_file } = req;

  if (!subject || !from || !to || !body || !media_file) {
    throw new Error("All fields (subject, from, to, body, media_file) are required");
  }

  const formattedPhoneNumber = formatPhoneNumber(to);

  const endpoint = 'https://rest.clicksend.com/v3/mms/send';
  const payload = JSON.stringify({
    media_file: media_file,
    messages: [
      {
        source: "typescript",
        subject: subject,
        from: from,
        body: body,
        to: formattedPhoneNumber,
        country: "GB" // Assuming UK for this function
      }
    ]
  });

  const authString = base64Encode(`${clickSendApiUsername}:${clickSendApiKey}`);

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

async function handleMMSRequest(req: MMSRequest): Promise<Response> {
  console.log("Handling MMS request");
  console.log(`Request details: ${JSON.stringify(req, null, 2)}`);

  try {
    const response = await sendMMS(req);
    const responseBody = await response.text();
    console.log(`ClickSend API Response (${response.status}):`);
    console.log(responseBody);

    if (response.ok) {
      console.log("Preparing success response");
      return new Response(JSON.stringify({ success: true, message: "MMS sent successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Error sending MMS: ClickSend API returned non-200 status code");
      return new Response(JSON.stringify({ success: false, error: "Failed to send MMS" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error(`Error sending MMS: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return new Response(JSON.stringify({ success: false, error: "Failed to send MMS" }), {
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
      const body: MMSRequest = await req.json();
      console.log("Request body parsed successfully");
      return await handleMMSRequest(body);
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