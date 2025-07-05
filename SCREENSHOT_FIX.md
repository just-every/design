# Screenshot Reference Fix

## Problem
Screenshots were being saved to `screenshots/` directory with hash-based names and then used directly as source images, instead of being properly managed in the `reference/` folder with ID-based names.

Example of the issue:
```
source_images: [
    '/path/reference/5.jpg',  // Good - ID-based reference
    '/path/screenshots/Pinterest_Pin_3_2025-07-05T01-17-52-108Z_8093a1e9.png'  // Bad - screenshot with hash
]
```

## Solution

### 1. Screenshot Registration as Reference Images
When screenshots are registered in the image registry, they are now:
- Recognized as reference images (for inspiration category)
- Copied to the `reference/` folder with ID-based names
- Original screenshot files in `screenshots/` are kept but not used

### 2. Changes Made

**In `src/design-search.ts`:**
```typescript
// Screenshots are now recognized as reference images for inspiration
const isReference = img.url.startsWith('http://') || img.url.startsWith('https://') || 
                   (img.url.includes('/screenshots/') && category === 'inspiration');
```

**In `src/utils/image-registry.ts`:**
```typescript
// Copy local screenshots to reference folder with ID-based name
else if (imagePath.includes('/screenshots/') && fs.existsSync(imagePath)) {
    // ... copy to reference/ID.png
}
```

## Result

Now all reference images (including screenshots) are:
1. Saved in the `reference/` folder
2. Named with their ID (e.g., `1.jpg`, `2.png`, `3.png`)
3. Consistently referenced by their ID throughout the system

Example after fix:
```
source_images: [
    '/path/reference/5.jpg',   // Downloaded image
    '/path/reference/6.png'    // Screenshot copied from screenshots/
]
```

## Benefits
- **Consistency**: All reference images in one place
- **Simplicity**: ID-based naming for all references
- **Clean paths**: No more complex hash-based filenames in source_images
- **Easy debugging**: Can immediately see which files are being used