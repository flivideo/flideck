# BUG-15: Keyboard Navigation Breaks After Clicking Slide from Tab Landing Page

## Summary

Cmd+Arrow keyboard navigation stops working after clicking a slide card from within a tab landing page (index-*.html). This is a **critical bug** that breaks the presentation workflow.

## Problem Statement

**Reproduction steps:**
1. Go to `http://localhost:5200/presentation/bmad-poem`
2. Click on "EPIC1" tab in the tab bar
3. Tab landing page loads (`index-epic1.html`) showing card grid
4. Press `Cmd+Right` → **Works** (can navigate to next asset)
5. Click on any card in the iframe (e.g., "1.1 INITIATIVE")
6. Slide loads inside iframe
7. Press `Cmd+Right` → **BROKEN** - nothing happens

**Expected behavior:**
- Cmd+Arrow should ALWAYS work, regardless of how user navigated to current slide

**Impact:**
- **Cannot present** - keyboard navigation is essential for smooth presentations
- Have to use mouse to click sidebar items
- Defeats purpose of keyboard shortcuts

## Technical Analysis

### The Two Loading Modes

FliDeck has two ways of loading content into the iframe:

| Mode | Trigger | How It Works | Keyboard Bridge |
|------|---------|--------------|-----------------|
| **Tab mode** | Click tab in tab bar | `iframe.src = "index-epic1.html"` | **NOT INJECTED** (external file) |
| **Slide mode** | Click slide in sidebar | `iframe.srcdoc = "<html>...</html>"` | **INJECTED** (inline content) |

### What Happens

```
Step 1: Click EPIC1 tab
────────────────────────
FliDeck: iframe.src = "index-epic1.html"
         (loads external file, no script injection)
         Keyboard bridge: NOT PRESENT in index-epic1.html

But wait - Cmd+Arrow works here. Why?
Because the keyboard script also listens on the WINDOW level,
not just inside the iframe. When iframe doesn't capture the event,
window handler catches it.

Step 2: Click card inside iframe
────────────────────────────────
User clicks "1.1 INITIATIVE" card in index-epic1.html
The iframe's internal JavaScript does: window.location = "e1-initiative.html"
Or: the card is a regular <a href="e1-initiative.html">

PROBLEM: The iframe navigates INTERNALLY.
FliDeck's React state doesn't know this happened.
- selectedAssetId is still null (or still on "index-epic1.html")
- currentAssetIndex doesn't update
- The slide list for Cmd+Arrow navigation is wrong

Step 3: Press Cmd+Right
───────────────────────
Window handler fires, but:
- currentAssetIndex is wrong (still thinks we're on index page)
- Navigation tries to go to "next" slide from wrong position
- Or there's no "next" because state is confused
```

### Root Cause

**The iframe boundary is opaque to FliDeck's state management.**

When a user clicks a card INSIDE the iframe:
1. The iframe navigates internally (`src` changes)
2. FliDeck (React) has NO IDEA this happened
3. `selectedAssetId` doesn't update
4. `currentAssetIndex` is stale
5. Keyboard navigation operates on stale state

### Why It's Hard

This is the **iframe boundary problem** discussed in the Knowledge Base Section 5:

> **What Crosses the Boundary**
> | Direction | What | How |
> |-----------|------|-----|
> | FliDeck → Iframe | Which content to display | `iframe.src` or `iframe.srcdoc` |
> | Iframe → FliDeck | **Nothing currently** | (Future: postMessage for interactions?) |

The "nothing currently" is the bug. Iframe clicks need to notify FliDeck.

## Proposed Solutions

### Solution A: PostMessage Navigation Bridge (Recommended)

Index pages should notify FliDeck when user clicks a card:

**In index-epic1.html:**
```html
<script>
  document.querySelectorAll('[data-slide]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault(); // Don't navigate internally
      const slideFile = card.dataset.slide;
      window.parent.postMessage({
        type: 'flideck:navigate',
        slide: slideFile
      }, '*');
    });
  });
</script>
```

**In FliDeck (PresentationPage.tsx):**
```typescript
useEffect(() => {
  const handleMessage = (event: MessageEvent) => {
    if (event.data?.type === 'flideck:navigate') {
      const slideFile = event.data.slide;
      // Update React state
      const assetIndex = assets.findIndex(a => a.file === slideFile);
      setSelectedAssetId(slideFile);
      setCurrentAssetIndex(assetIndex);
      // Load slide via srcdoc (with keyboard bridge injected)
    }
  };
  window.addEventListener('message', handleMessage);
  return () => window.removeEventListener('message', handleMessage);
}, [assets]);
```

**Pros:**
- Clean separation of concerns
- FliDeck controls all navigation
- Keyboard bridge always injected via srcdoc

**Cons:**
- Requires ALL index pages to include the script
- Existing index pages won't work until updated

### Solution B: Iframe Load Detection

Listen for iframe `load` events and detect when content changed:

```typescript
const iframeRef = useRef<HTMLIFrameElement>(null);

useEffect(() => {
  const iframe = iframeRef.current;
  if (!iframe) return;

  const handleLoad = () => {
    try {
      // Try to get current URL from iframe
      const currentUrl = iframe.contentWindow?.location.href;
      if (currentUrl) {
        const filename = currentUrl.split('/').pop();
        const assetIndex = assets.findIndex(a => a.file === filename);
        if (assetIndex >= 0) {
          setSelectedAssetId(filename);
          setCurrentAssetIndex(assetIndex);
        }
      }
    } catch (e) {
      // Cross-origin issues - can't read iframe location
    }
  };

  iframe.addEventListener('load', handleLoad);
  return () => iframe.removeEventListener('load', handleLoad);
}, [assets]);
```

**Pros:**
- Works without modifying index pages
- Automatic detection

**Cons:**
- Cross-origin restrictions may block reading iframe URL
- Still doesn't inject keyboard bridge into the newly loaded page

### Solution C: Intercept All Navigation (Most Robust)

Inject a script into ALL iframe content (both `src` and `srcdoc`) that:
1. Intercepts all `<a>` clicks and form submissions
2. Sends postMessage to parent
3. Lets parent decide how to handle

**Cons:**
- Complex injection for `src` loaded content
- May interfere with legitimate internal navigation

### Solution D: Tab Landing Pages Use srcdoc Too

Instead of `iframe.src = "index-epic1.html"`, fetch the HTML and use `iframe.srcdoc`:

```typescript
const loadTabIndex = async (tabFile: string) => {
  const response = await fetch(`/presentations/${presentationId}/${tabFile}`);
  const html = await response.text();
  // Inject keyboard bridge and navigation bridge
  const enhancedHtml = injectBridgeScripts(html);
  iframe.srcdoc = enhancedHtml;
};
```

**Pros:**
- Keyboard bridge always injected
- FliDeck controls all content
- Can inject navigation bridge too

**Cons:**
- More complex loading logic
- Need to handle relative URLs in the HTML

## Recommended Approach

**Combination of A + D:**

1. **Tab index pages loaded via srcdoc** with bridge scripts injected (Solution D)
2. **Bridge scripts include navigation listener** that sends postMessage on card clicks (Solution A)
3. **FliDeck listens for postMessage** and updates state + loads slide via srcdoc
4. **All iframe content has keyboard bridge** because everything is srcdoc

This ensures:
- Keyboard always works (bridge always present)
- Navigation always updates state (postMessage)
- Single loading mechanism (srcdoc for everything)

## Acceptance Criteria

- [ ] Cmd+Arrow works after clicking a tab in the tab bar
- [ ] Cmd+Arrow works after clicking a card inside the tab landing page
- [ ] Cmd+Arrow works after clicking a slide in the sidebar
- [ ] State (selectedAssetId, currentAssetIndex) updates correctly on ALL navigation paths
- [ ] Keyboard bridge script is present in ALL iframe content
- [ ] Works with existing bmad-poem presentation

## Files to Investigate

- `client/src/pages/PresentationPage.tsx` - Navigation state management
- `client/src/components/ui/AssetViewer.tsx` - Iframe loading, keyboard bridge injection
- `client/src/hooks/useContainerTab.ts` - Tab state management

## Related

- FR-05 (Presentation Controls) - Defined keyboard architecture
- FR-24 (Container Tab Navigation) - Introduced tab landing pages
- BUG-14 (Agent API missing authoring specs) - Root cause prevention
- Knowledge Base Section 5 (Iframe Boundary) - Conceptual background

## Priority

**CRITICAL** - Breaks core presentation functionality. Cannot present without keyboard navigation.

## Complexity

**HIGH** - Touches iframe boundary, state management, multiple loading paths. Requires careful architecture.

---

**Added**: 2025-12-28
**Status**: Open
**Type**: Bug
**Found in**: bmad-poem presentation testing
**Severity**: Critical
