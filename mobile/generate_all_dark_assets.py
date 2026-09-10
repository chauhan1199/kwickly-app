import os
from PIL import Image, ImageDraw, ImageFont
import numpy as np

IMG_DIR = r"d:\kwickly\11-4-26\mobile\src\assets\images"
RES_DRAWABLE = r"d:\kwickly\11-4-26\mobile\android\app\src\main\res\drawable-mdpi"

# ══════════════════════════════════════════════════════════════════
# 1. SIX SERVICE CHIPS (109x103)
# ══════════════════════════════════════════════════════════════════
CHIP_LABELS = {
    'chip_plumbing.png': 'Plumbing',
    'chip_car.png': 'Car Repair',
    'chip_groceries.png': 'Groceries',
    'chip_electrician.png': 'Electrician',
    'chip_cleaning.png': 'Cleaning',
    'chip_delivery.png': 'Delivery',
}

font = ImageFont.truetype(r'C:\Windows\Fonts\segoeuib.ttf', 12)

def generate_chips():
    print("Generating 6 dark service chips...")
    for name, label in CHIP_LABELS.items():
        im = Image.open(os.path.join(IMG_DIR, name)).convert('RGBA')
        w, h = im.size
        arr = np.array(im, dtype=np.float32)
        
        max_c = np.maximum(np.maximum(arr[:, :, 0], arr[:, :, 1]), arr[:, :, 2])
        min_c = np.minimum(np.minimum(arr[:, :, 0], arr[:, :, 1]), arr[:, :, 2])
        sat = (max_c - min_c) / (max_c + 1e-5)
        
        # Base card #131B2E (19, 27, 46)
        out = np.zeros((h, w, 4), dtype=np.uint8)
        out[:, :] = [19, 27, 46, 255]
        
        bg_weight = np.clip((min_c - 210.0) / 35.0, 0.0, 1.0) * (1.0 - np.clip((sat - 0.08) / 0.12, 0.0, 1.0))
        icon_weight = 1.0 - bg_weight
        
        # Zero out bottom 32% where old light text was
        y_coords = np.arange(h)
        is_bottom = np.tile((y_coords > (h * 0.68))[:, None], (1, w))
        icon_weight[is_bottom] = 0.0
        
        for c in range(3):
            out[:, :, c] = np.clip(
                out[:, :, c] * (1.0 - icon_weight) + arr[:, :, c] * icon_weight,
                0, 255
            ).astype(np.uint8)
            
        out_img = Image.fromarray(out, 'RGBA')
        draw = ImageDraw.Draw(out_img)
        # Rounded card border
        draw.rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=10, outline=(40, 56, 88, 255), width=1)
        
        # Centered label
        bbox = font.getbbox(label)
        text_w = bbox[2] - bbox[0]
        text_x = (w - text_w) // 2
        text_y = 80
        draw.text((text_x, text_y), label, fill=(241, 245, 249, 255), font=font)
        
        out_name = name.replace('.png', '_dark.png')
        out_path = os.path.join(IMG_DIR, out_name)
        out_img.save(out_path)
        print(f"  [OK] Saved {out_name}")

# ══════════════════════════════════════════════════════════════════
# 2. HERO 3D ILLUSTRATIONS
# ══════════════════════════════════════════════════════════════════
def generate_heroes():
    print("Generating 4 dark hero illustrations...")
    
    # A. hero_create_account_dark.png
    im = Image.open(os.path.join(IMG_DIR, 'hero_create_account.png')).convert('RGBA')
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    # Erase cropped text on left
    mask_text = (np.arange(w)[None, :] < 75) & (np.arange(h)[:, None] > 170)
    arr[mask_text, :3] = [247, 248, 254]
    
    b_light = np.array([247.0, 248.0, 254.0])
    b_dark = np.array([17.0, 24.0, 42.0]) # #11182A
    diff = np.abs(arr[:, :, :3] - b_light)
    dist = np.max(diff, axis=2)
    alpha = np.clip((dist - 8.0) / 36.0, 0.0, 1.0)
    shift = (1.0 - alpha[:, :, None]) * (b_dark - b_light)
    new_rgb = np.clip(arr[:, :, :3] + shift, 0, 255).astype(np.uint8)
    out_arr = np.dstack([new_rgb, np.full((h, w), 255, dtype=np.uint8)])
    out_img = Image.fromarray(out_arr, 'RGBA')
    # Rounded card mask
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, fill=255)
    out_img.putalpha(mask)
    ImageDraw.Draw(out_img).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, outline=(36, 49, 77, 255), width=1)
    out_img.save(os.path.join(IMG_DIR, 'hero_create_account_dark.png'))
    print("  [OK] Saved hero_create_account_dark.png")

    # B. hero_login_dark.png
    im = Image.open(os.path.join(IMG_DIR, 'hero_login.png')).convert('RGBA')
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    # Erase cropped text on left margin x < 45
    mask_text = (np.arange(w)[None, :] < 45) & (np.arange(h)[:, None] > 250)
    arr[mask_text, :3] = [244, 246, 254]
    
    b_light = np.array([244.0, 248.0, 254.0])
    b_dark = np.array([17.0, 24.0, 42.0])
    diff = np.abs(arr[:, :, :3] - b_light)
    dist = np.max(diff, axis=2)
    alpha = np.clip((dist - 8.0) / 36.0, 0.0, 1.0)
    shift = (1.0 - alpha[:, :, None]) * (b_dark - b_light)
    new_rgb = np.clip(arr[:, :, :3] + shift, 0, 255).astype(np.uint8)
    out_arr = np.dstack([new_rgb, np.full((h, w), 255, dtype=np.uint8)])
    out_img = Image.fromarray(out_arr, 'RGBA')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, fill=255)
    out_img.putalpha(mask)
    ImageDraw.Draw(out_img).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, outline=(36, 49, 77, 255), width=1)
    out_img.save(os.path.join(IMG_DIR, 'hero_login_dark.png'))
    print("  [OK] Saved hero_login_dark.png")

    # C. hero_mpin_dark.png
    im = Image.open(os.path.join(IMG_DIR, 'hero_mpin.png')).convert('RGBA')
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    # Erase cropped text on left
    mask_text = (np.arange(w)[None, :] < 50) & (np.arange(h)[:, None] > 190)
    arr[mask_text, :3] = [244, 246, 254]
    
    b_light = np.array([244.0, 246.0, 254.0])
    b_dark = np.array([17.0, 24.0, 42.0])
    diff = np.abs(arr[:, :, :3] - b_light)
    dist = np.max(diff, axis=2)
    alpha = np.clip((dist - 8.0) / 36.0, 0.0, 1.0)
    shift = (1.0 - alpha[:, :, None]) * (b_dark - b_light)
    new_rgb = np.clip(arr[:, :, :3] + shift, 0, 255).astype(np.uint8)
    out_arr = np.dstack([new_rgb, np.full((h, w), 255, dtype=np.uint8)])
    out_img = Image.fromarray(out_arr, 'RGBA')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, fill=255)
    out_img.putalpha(mask)
    ImageDraw.Draw(out_img).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, outline=(36, 49, 77, 255), width=1)
    out_img.save(os.path.join(IMG_DIR, 'hero_mpin_dark.png'))
    print("  [OK] Saved hero_mpin_dark.png")

    # D. hero_welcome_dark.png
    im = Image.open(os.path.join(IMG_DIR, 'hero_welcome.png')).convert('RGBA')
    w, h = im.size
    arr = np.array(im, dtype=np.float32)
    b_dark = np.array([17.0, 23.0, 38.0]) # #111726
    y_idx = np.arange(h)[:, None]
    x_idx = np.arange(w)[None, :]
    
    is_text = (x_idx < 120) & (y_idx < 110) & (arr[:, :, 2] > 110) & (arr[:, :, 1] < 110) & (arr[:, :, 0] < 150)
    is_phone_top = (x_idx > 130) & (y_idx < 70) & (arr[:, :, 0] < 120) & (arr[:, :, 1] < 120)
    is_helmet = (y_idx > 80) & (arr[:, :, 2] > 140) & (arr[:, :, 1] < 130)
    is_sky = (y_idx < 125) & (arr[:, :, 0] > 140) & (arr[:, :, 1] > 165) & (arr[:, :, 2] > 210) & (~is_text) & (~is_phone_top) & (~is_helmet)
    # buildings in background
    is_bldg = (y_idx >= 125) & (y_idx < 210) & (x_idx < 110) & (arr[:, :, 0] > 140) & (arr[:, :, 1] > 150) & (arr[:, :, 2] > 180)
    
    b_light = np.array([246.0, 248.0, 254.0])
    diff = np.abs(arr[:, :, :3] - b_light)
    dist = np.max(diff, axis=2)
    dist[is_sky] = 0.0
    dist[is_bldg] = 0.0
    
    alpha = np.clip((dist - 8.0) / 36.0, 0.0, 1.0)
    shift = (1.0 - alpha[:, :, None]) * (b_dark - b_light)
    new_rgb = np.clip(arr[:, :, :3] + shift, 0, 255).astype(np.uint8)
    out_arr = np.dstack([new_rgb, np.full((h, w), 255, dtype=np.uint8)])
    out_img = Image.fromarray(out_arr, 'RGBA')
    mask = Image.new('L', (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, fill=255)
    out_img.putalpha(mask)
    ImageDraw.Draw(out_img).rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=16, outline=(36, 49, 77, 255), width=1)
    out_img.save(os.path.join(IMG_DIR, 'hero_welcome_dark.png'))
    print("  [OK] Saved hero_welcome_dark.png")

# ══════════════════════════════════════════════════════════════════
# 3. THREE FOOTER ILLUSTRATIONS
# ══════════════════════════════════════════════════════════════════
def generate_footers():
    print("Generating 3 dark footer illustrations...")
    for name in ['footer_landscape.png', 'footer_create_account.png', 'footer_login.png']:
        im = Image.open(os.path.join(IMG_DIR, name)).convert('RGBA')
        w, h = im.size
        arr = np.array(im, dtype=np.float32)
        r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
        
        y_idx = np.arange(h)[:, None]
        x_idx = np.arange(w)[None, :]
        
        # Exact #0B0F19 (11, 15, 25) at top y=0 to (20, 26, 42) at bottom
        sky_r = 11.0 + (y_idx / float(h)) * 9.0
        sky_g = 15.0 + (y_idx / float(h)) * 11.0
        sky_b = 25.0 + (y_idx / float(h)) * 17.0
        
        out = np.zeros((h, w, 4), dtype=np.float32)
        out[:, :, 0] = np.tile(sky_r, (1, w))
        out[:, :, 1] = np.tile(sky_g, (1, w))
        out[:, :, 2] = np.tile(sky_b, (1, w))
        out[:, :, 3] = 255.0
        
        # Elements
        is_tree = (g > r * 1.06) & (g > b * 0.96) & (g > 65)
        is_text = (x_idx < (w * 0.28)) & (y_idx < (h * 0.70)) & (b > 115) & (g < 115) & (r < 155)
        
        # Sky detection
        is_sky = (r > 195) & (g > 190) & (b > 210)
        
        # Rider detection (in footer_create_account):
        # Scooter purple (b > 140, g < 100), delivery box (b > 70, g < 70), peach skin (r > g > b, r > 200, g > 140), dark tires (r,g,b < 60)
        is_rider = np.zeros((h, w), dtype=bool)
        if 'create_account' in name:
            is_rider_box = (x_idx >= 320) & (x_idx <= 430) & (y_idx >= 20) & (y_idx <= 145)
            # Must not be sky, and must not be road surface (g > 140 and b > 200)
            is_road_color = (g > 140) & (b > 200)
            is_rider = is_rider_box & (~is_sky) & (~is_road_color)
            
        # Glass card (in footer_login)
        is_card = np.zeros((h, w), dtype=bool)
        if 'footer_login' in name:
            is_card = (x_idx >= 430) & (x_idx <= 562) & (y_idx >= 12) & (y_idx <= 122) & ((r < 242) | (g < 242) | (b < 246))

        # Road
        is_road_zone = (y_idx > (h * 0.52)) & (x_idx > (w * 0.20)) & (~is_tree) & (~is_rider)
        is_road = is_road_zone & (b > 150) & (r > 115) & (g > 115)
        is_lane = is_road & (x_idx > (w * 0.38)) & (r > 230) & (g > 230) & (b > 238)
        
        # Buildings
        is_building = (y_idx < (h * 0.68)) & (x_idx > (w * 0.22)) & (~is_tree) & (~is_rider) & (~is_card) & (~is_text) & (~is_sky)
        
        # Render Buildings
        b_alpha = np.clip((238.0 - r) / 45.0, 0.0, 1.0) * is_building
        for c, col in enumerate([24, 32, 52]):
            out[:, :, c] = out[:, :, c] * (1.0 - b_alpha) + col * b_alpha
            
        # Window lights
        grid_y = (y_idx % 7 == 0) & (y_idx > 22) & (y_idx < (h * 0.62))
        grid_x = (x_idx % 9 == 0)
        window_dots = is_building & grid_y & grid_x & (np.sin(y_idx * 0.7 + x_idx * 0.4) > 0.15)
        out[window_dots, 0] = 252
        out[window_dots, 1] = 215
        out[window_dots, 2] = 125
        
        # Render Road
        road_alpha = np.clip((y_idx - (h * 0.54)) / 8.0, 0.0, 1.0) * is_road
        for c, col in enumerate([21, 27, 40]):
            out[:, :, c] = out[:, :, c] * (1.0 - road_alpha) + col * road_alpha
        out[is_lane, :3] = [235, 240, 250]
        
        # Render Trees
        tree_intensity = np.clip(g / 255.0, 0.0, 1.0)
        tree_alpha = np.clip((g - r * 1.03) / 14.0, 0.0, 1.0) * is_tree
        t_r = 13.0 + tree_intensity * 18.0
        t_g = 42.0 + tree_intensity * 60.0
        t_b = 24.0 + tree_intensity * 28.0
        out[:, :, 0] = out[:, :, 0] * (1.0 - tree_alpha) + t_r * tree_alpha
        out[:, :, 1] = out[:, :, 1] * (1.0 - tree_alpha) + t_g * tree_alpha
        out[:, :, 2] = out[:, :, 2] * (1.0 - tree_alpha) + t_b * tree_alpha
        
        # Render Rider
        if 'create_account' in name:
            rider_alpha = np.clip((225.0 - np.minimum(np.minimum(r, g), b)) / 25.0, 0.0, 1.0) * is_rider
            for c in range(3):
                out[:, :, c] = out[:, :, c] * (1.0 - rider_alpha) + arr[:, :, c] * rider_alpha
                
        # Render Glass Card
        if 'footer_login' in name:
            card_mask = is_card
            for c, col in enumerate([20, 28, 46]):
                out[card_mask, c] = col
            is_icon = card_mask & (b > 135) & (g < 110)
            out[is_icon, :3] = [168, 85, 247]
            is_card_txt = card_mask & (r < 110) & (g < 110) & (b < 120)
            out[is_card_txt, :3] = [241, 245, 249]
            
        # Render Text "Local People Brighter Tomorrows" (radiant neon lavender #C4B5FD)
        text_alpha = np.clip((b - g * 1.15) / 22.0, 0.0, 1.0) * is_text
        for c, col in enumerate([196, 181, 253]):
            out[:, :, c] = out[:, :, c] * (1.0 - text_alpha) + col * text_alpha
            
        # Ensure exact #0B0F19 at top 3 rows
        out[:3, :, 0] = 11
        out[:3, :, 1] = 15
        out[:3, :, 2] = 25
        out[:, :, 3] = 255.0
        
        out_name = name.replace('.png', '_dark.png')
        out_img = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), 'RGBA')
        out_img.save(os.path.join(IMG_DIR, out_name))
        print(f"  [OK] Saved {out_name}")

def sync_to_android_res():
    import shutil
    print("Syncing dark assets to Android drawable-mdpi...")
    if os.path.exists(RES_DRAWABLE):
        for f in os.listdir(IMG_DIR):
            if f.endswith('_dark.png'):
                shutil.copy2(os.path.join(IMG_DIR, f), os.path.join(RES_DRAWABLE, f))
                print(f"  [OK] Copied {f} to android res")

if __name__ == '__main__':
    generate_chips()
    generate_heroes()
    generate_footers()
    sync_to_android_res()
    print("All dark mode image assets generated & synced successfully!")
