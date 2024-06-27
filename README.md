# i5 AI demos

Some Supabase Edge functions to support AI demos for i5

## File Upload

Publish an arbitrary file to the web by POSTing json:

    curl --location 'http://localhost:54321/functions/v1/publish-file' \
    --header 'Content-Type: application/json' \
    --header 'Authorization: Bearer <supabase anon access token>' \
    --data '{
    "folder": "adamtesting",
    "filename": "file1.txt",
    "data": "File contents go here - updated again",
    "mime_type": "text/plain"
    }'

Response contains the published url like:

    {
    "url": "https://incept5ai-demos.s3.eu-west-1.amazonaws.com/adamtesting/file1.txt"
    }

A second request with the same folder+filename will replace the existing file.