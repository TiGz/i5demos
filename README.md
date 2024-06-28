# i5 AI demos

Some Supabase Edge functions to support AI demos for i5

## File Upload

Publish an arbitrary file to the web by POSTing json:

    curl --location 'https://dmkjdggyqwksrktvixhk.supabase.co/functions/v1/publish-file' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Bearer <anon_api_key>' \
    --data '{
    "folder": "adamtesting",
    "filename": "file1.txt",
    "data": "File contents go here - updated again foo meow",
    "mime_type": "text/plain"
    }'

Response contains the published url like:

    {
    "url": "https://incept5ai-demos.s3.eu-west-1.amazonaws.com/adamtesting/file1.txt"
    }

A second request with the same folder+filename will replace the existing file.

You can also upload images by encoding the data in base64 like:

    {
    "folder": "adamtesting",
    "filename": "image1.png",
    "data": "/9j/4AAQSkZJRgABAQAAAQABAAD<snipped_for_brevity>/2Q==",
    "mime_type": "image/jpeg",
    "type":"base64"
    }

The files are published to a bucket in s3 and are made publically readable.

## Send SMS

Send an arbitrary SMS:

    curl --location 'https://dmkjdggyqwksrktvixhk.supabase.co/functions/v1/send-sms' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Bearer <anon_api_key>' \
    --data '{
    "phone": "07780962961",
    "message": "this is another test for Adam"
    }'

Returns a response like:

    {
    "success": true,
    "message": "SMS sent successfully"
    }

Will assume UK number if country code is left off. May not send to all countries... let me know if there are issues.

Might run out of credit if used a lot... uses ClickSend under the covers.