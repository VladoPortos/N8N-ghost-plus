# N8N Ghost Plus Node

Enhanced Ghost CMS integration for n8n with support for Ghost Content API v3 and Admin API v2.

<a href='https://ko-fi.com/J3J52ZNN2' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi6.png?v=6' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

## Features

This node extends the default Ghost CMS integration with additional features:

### Content API (v3)
- **Get Post**: Retrieve a single post by ID or slug
- **Get Many Posts**: Retrieve multiple posts with filtering options

### Admin API (v2)
- **Post Management**:
  - Create: Create new blog posts
  - Get: Retrieve a single post by ID or slug
  - Get Many: Retrieve multiple posts with filtering options
  - Update: Update existing blog posts
  - Delete: Remove posts from your Ghost site
  - **Feature Image Support**:
    - `feature_image`: Set a featured image URL for your post
    - `feature_image_alt`: Add alternative text for the featured image
    - `feature_image_caption`: Add a caption for the featured image

- **Image Upload** (NEW in 0.1.77):
  - Upload images directly to your Ghost CMS media library
  - Support for different image purposes (general image, profile image, icon)
  - Custom file name and reference metadata

## Requirements

- N8N version 1.0.0 or later
- Ghost CMS instance with Content API or Admin API credentials

## Installation

Install via NPM:

```bash
npm install @vladoportos/n8n-nodes-ghostplus
```

For manual installation, copy the contents of the `dist` directory to your n8n custom nodes directory.

## Usage

### Credentials

Two credential types are available:

1. **Ghost Plus Content API**
   - URL: Your Ghost site URL (e.g., https://your-ghost-site.com)
   - API Key: Your Content API key

2. **Ghost Plus Admin API**
   - URL: Your Ghost site URL (e.g., https://your-ghost-site.com)
   - API Key: Your Admin API key in the format `{id}:{secret}`

### Working with Posts

Select the "Post" resource to work with blog posts. Operations differ based on the selected API source:

#### Content API
- Get: Retrieve a post by ID or slug
- Get Many: List multiple posts with filtering options

#### Admin API
- Create: Create a new blog post with title, content format (HTML or MobileDoc), and content
- Get: Retrieve a post by ID or slug
- Get Many: List multiple posts with filtering options
- Update: Modify an existing post
- Delete: Remove a post

### Image Upload (Admin API)

Select the "Image" resource and "Upload" operation to add images to your Ghost CMS. Required parameters:

- **Binary Property**: Name of the binary property containing the image data
- **Additional Fields**:
  - Purpose: Choose between "Image", "Profile Image" (must be square), or "Icon" (must be square)
  - File Name: Custom file name for the uploaded image (optional)
  - Reference: Optional reference identifier for the image (e.g., original file path)

## Example Usage

### Upload an Image and Use in a Post

1. Use a node to fetch or generate an image (HTTP Request, Read Binary File, etc.)
2. Connect to Ghost Plus node configured with:
   - Source: Admin API
   - Resource: Image
   - Operation: Upload
   - Binary Property: data (or your binary property name)
3. Add another Ghost Plus node configured with:
   - Source: Admin API
   - Resource: Post
   - Operation: Create
   - Title: Your post title
   - Content: Include the uploaded image URL from the previous node in your HTML content

## License

MIT
