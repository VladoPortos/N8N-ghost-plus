![Banner image](https://user-images.githubusercontent.com/10284570/173569848-c624317f-42b1-45a6-ab09-f0ea3c247648.png)

# n8n-nodes-ghostv2

This is a node for [n8n](n8n.io) that integrates with Ghost CMS API v2. It provides functionality to interact with Ghost's Admin and Content APIs, including support for managing posts and uploading images.

## Features

- Create, read, update, and delete posts
- Upload images with support for different purposes (general image, profile image, icon)
- Support for both Admin API and Content API
- Handle feature images with alt text and captions
- Support for HTML and Mobiledoc content formats

## Installation

To install this node in your n8n instance:

```bash
npm install n8n-nodes-ghostv2
```

## Usage

1. Create a new workflow in n8n
2. Add the Ghost V2 node
3. Configure your credentials:
   - For Admin API: Use your Admin API key from Ghost settings
   - For Content API: Use your Content API key from Ghost settings

### Operations

The node supports the following operations:

#### Posts
- Create Post
- Update Post
- Delete Post
- Get Post
- Get All Posts

#### Images
- Upload Image (supports general images, profile images, and icons)

### Example Usage

1. **Create a Post with Feature Image**
   - First, use the "Upload Image" operation to upload your feature image
   - Then, use the "Create Post" operation and set the feature_image field to the URL returned from the upload

2. **Update a Post**
   - Use the "Update Post" operation
   - You can update any post field including feature images and their metadata

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/VladoPortos/N8N-ghost-v2.git
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the node:
   ```bash
   pnpm run build
   ```

4. Link to your n8n installation for testing:
   ```bash
   pnpm link
   ```

## License

[MIT](LICENSE.md)
