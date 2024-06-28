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

interface SMSRequest {
  phone: string;
  message: string;
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

async function sendSMS(phoneNumber: string, message: string): Promise<Response> {
  if (!phoneNumber || !message) {
    throw new Error("Both phone number and message are required");
  }

  const formattedPhoneNumber = formatPhoneNumber(phoneNumber);

  const endpoint = 'https://rest.clicksend.com/v3/sms/send';
  const payload = JSON.stringify({
    messages: [
      {
        source: "typescript",
        body: message,
        to: formattedPhoneNumber
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

async function handleSMSRequest(req: SMSRequest): Promise<Response> {
  console.log("Handling SMS request");
  console.log(`Request details: ${JSON.stringify(req, null, 2)}`);

  const { phone, message } = req;

  if (!phone || !message) {
    return new Response(JSON.stringify({ success: false, error: "Both phone and message are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await sendSMS(phone, message);
    const responseBody = await response.text();
    console.log(`ClickSend API Response (${response.status}):`);
    console.log(responseBody);

    if (response.ok) {
      console.log("Preparing success response");
      return new Response(JSON.stringify({ success: true, message: "SMS sent successfully" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } else {
      console.error("Error sending SMS: ClickSend API returned non-200 status code");
      return new Response(JSON.stringify({ success: false, error: "Failed to send SMS" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error(`Error sending SMS: ${error.message}`);
    console.error(`Stack trace: ${error.stack}`);
    return new Response(JSON.stringify({ success: false, error: "Failed to send SMS" }), {
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
      const body: SMSRequest = await req.json();
      console.log("Request body parsed successfully");
      return await handleSMSRequest(body);
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