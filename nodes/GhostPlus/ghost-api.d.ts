// Type definitions for @tryghost/admin-api and @tryghost/content-api
// This is a basic set of type definitions. Expand as needed.

declare module '@tryghost/admin-api' {
  interface GhostAdminAPIOptions {
    url: string;
    key: string;
    version: string; // e.g., 'v5.0', 'v4.0', 'v3.0', 'v2.0', 'canary'
    makeRequest?: (params: { url: string; method: string; data?: any; params?: any; headers?: any }) => Promise<any>; // Optional custom request function
  }

  interface GhostAdminAPIImageUploadOptions {
    file: string; // path to file
    ref?: string;
    thumbnail?: {
        file: string; // path to thumbnail file
    };
  }

  interface GhostAdminAPIMediaUploadOptions {
    file: string; // path to file
    ref?: string;
    duration?: number;
    thumbnail_file?: string; // path to thumbnail file
    [key: string]: any; // Allow other properties like 'title', 'caption'
  }

  interface GhostAPIBrowseParams {
    page?: number;
    limit?: number | 'all';
    order?: string;
    filter?: string;
    fields?: string | string[];
    include?: string | string[];
    formats?: string[]; // e.g. ['html', 'mobiledoc', 'plaintext']
    [key: string]: any; // Allow other query parameters
  }

  interface GhostAPIReadParams {
    fields?: string | string[];
    include?: string | string[];
    formats?: string[];
    [key: string]: any;
  }

  interface GhostAPIData {
    id?: string;
    slug?: string;
    uuid?: string;
    [key: string]: any; // Base for posts, pages, etc.
  }

  interface GhostAPIPostData extends GhostAPIData {
    title: string;
    // Add other post properties as needed
  }

  interface GhostAPIPageData extends GhostAPIData {
    title: string;
    // Add other page properties as needed
  }

  interface GhostAPIResourceAddOptions {
    source?: 'html' | 'mobiledoc';
    // Add other options as needed
    [key: string]: any;
  }

  interface GhostAPIResourceEditOptions extends GhostAPIResourceAddOptions {}

  interface GhostAPIResource {
    browse(options?: GhostAPIBrowseParams): Promise<any>;
    read(data: { id?: string; slug?: string; uuid?: string }, options?: GhostAPIReadParams): Promise<any>;
    add(data: GhostAPIData, options?: GhostAPIResourceAddOptions): Promise<any>;
    edit(dataWithId: { id: string } & Partial<GhostAPIData>, options?: GhostAPIResourceEditOptions): Promise<any>;
    delete(data: { id: string }): Promise<any>;
  }

  class GhostAdminAPI {
    constructor(options: GhostAdminAPIOptions);
    posts: GhostAPIResource;
    pages: GhostAPIResource;
    images: {
      upload(options: GhostAdminAPIImageUploadOptions): Promise<any>;
    };
    media: {
      upload(options: GhostAdminAPIMediaUploadOptions): Promise<any>;
    };
    // Add other resources like tags, members, site, etc. as needed
    // e.g. tags, users, members, site, themes, webhooks, offers, tiers, newsletters
    // For example:
    // tags: GhostAPIResource;
    // members: GhostAPIResource;
    // site: { read(): Promise<any>; };
  }
  export = GhostAdminAPI;
}

declare module '@tryghost/content-api' {
  interface GhostContentAPIOptions {
    url: string;
    key: string;
    version: string; // e.g., 'v5.0', 'v4.0', 'v3.0', 'v2.0', 'canary'
    ghostPath?: string; // Default: 'ghost'
    makeRequest?: (params: { url: string; method: string; params?: any; headers?: any }) => Promise<any>; // Optional custom request function
  }

  interface GhostAPIBrowseParams {
    page?: number;
    limit?: number | 'all';
    order?: string;
    filter?: string;
    fields?: string | string[];
    include?: string | string[];
    formats?: string[];
    [key: string]: any;
  }

  interface GhostAPIReadParams {
    fields?: string | string[];
    include?: string | string[];
    formats?: string[];
    [key: string]: any;
  }

  interface GhostAPIResource {
    browse(options?: GhostAPIBrowseParams): Promise<any>;
    read(data: { id?: string; slug?: string; uuid?: string }, options?: GhostAPIReadParams): Promise<any>;
  }

  class GhostContentAPI {
    constructor(options: GhostContentAPIOptions);
    posts: GhostAPIResource;
    authors: GhostAPIResource;
    tags: GhostAPIResource;
    pages: GhostAPIResource;
    settings: {
      browse(): Promise<any>;
    };
    // Add other resources as needed
  }
  export = GhostContentAPI;
}
