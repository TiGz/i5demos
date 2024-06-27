# i5 AI demos

Some Supabase Edge functions to support AI demos for i5

## File Upload

Publish an arbitrary file to the web by POSTing json:

    curl --location 'https://dmkjdggyqwksrktvixhk.supabase.co/functions/v1/publish-file' \
    --header 'Content-Type: application/json' \
    --data '{
    "folder": "adamtesting",
    "filename": "file1.txt",
    "data": "File contents go here - updated again foo",
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