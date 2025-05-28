## Old API Usage and V2 References in GhostPlus Node

This list identifies areas in the `n8n-nodes-ghostplus` codebase that use direct API calls or reference older Ghost API versions (specifically v2 for admin tasks) and should be considered for refactoring to use the newer `@tryghost/admin-api` (v5.x) and `@tryghost/content-api` (v5.x) client libraries.

### 1. Generic API Request Wrapper: `ghostApiRequest`

- **File:** `nodes/GhostPlus/GenericFunctions.ts`
- **Function:** `ghostApiRequest`
- **Issue:** This function acts as a general wrapper for making API calls. It dynamically sets the API version in the URL (`v3` for content, `v2` for admin) and uses `this.helpers.requestWithAuthentication` for the actual HTTP request.
  ```typescript
  // Snippet from ghostApiRequest
  if (source === 'contentApi') {
      version = 'v3'; // Content API often uses v3 or latest stable
      credentialType = 'ghostPlusContentApi';
  } else {
      version = 'v2'; // Admin API was v2, now SDK uses v5.x style
      credentialType = 'ghostPlusAdminApi';
  }
  // ...
  options.uri = uri || `${credentials.url}/ghost/api/${version}${endpoint}`;
  // ...
  return await this.helpers.requestWithAuthentication.call(this, credentialType, options);
  ```
- **Recommendation:** Investigate all call sites of `ghostApiRequest`. Replace these calls with direct usage of the appropriate methods from the `@tryghost/admin-api` or `@tryghost/content-api` libraries. This will make the code more robust, type-safe, and aligned with Ghost's recommended SDK usage.

### 2. Media Upload Function: `ghostApiMediaUpload`

- **File:** `nodes/GhostPlus/GenericFunctions.ts`
- **Function:** `ghostApiMediaUpload`
- **Issue:** This function handles media uploads (e.g., videos, files) using a direct HTTP POST request to the v2 admin API endpoint.
  ```typescript
  // Snippet from ghostApiMediaUpload
  const options: OptionsWithUri = {
      method: 'POST',
      uri: `${credentials.url}/ghost/api/v2/admin/media/upload/`,
      formData, // Uses multipart/form-data
      json: true,
  };
  // ...
  return await this.helpers.requestWithAuthentication.call(this, 'ghostPlusAdminApi', options);
  ```
- **Recommendation:** Refactor this function to use the `api.media.upload()` method from the `@tryghost/admin-api` library. This is analogous to the `api.images.upload()` method we recently fixed and should provide a more stable and maintainable solution for media uploads.

### General Notes:

- The `@tryghost/admin-api` and `@tryghost/content-api` libraries abstract away the specific endpoint versioning (they typically point to `v5.x` or a compatible latest version for Ghost). Using these libraries is preferred over constructing API URLs manually with older version numbers like `v2`.
- When refactoring, ensure that the parameters and expected responses align with the SDK methods.
