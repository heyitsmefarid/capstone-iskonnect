#!/usr/bin/env python3
"""
Script to convert and resize icon for Android app - improved version
"""

import os
from PIL import Image

def resize_icon():
    # Define the sizes needed for different screen densities
    sizes = {
        'mipmap-mdpi': 48,
        'mipmap-hdpi': 72,
        'mipmap-xhdpi': 96,
        'mipmap-xxhdpi': 144,
        'mipmap-xxxhdpi': 192
    }
    
    # Source icon path
    source_icon = 'assets/images/icon.jpg'
    
    # Base output directory
    base_dir = 'android/app/src/main/res'
    
    print(f"Converting icon from {source_icon}")
    
    try:
        # Open the source image
        with Image.open(source_icon) as img:
            print(f"Source image size: {img.size}, mode: {img.mode}")
            
            # Convert to RGB first, then RGBA (better compatibility)
            if img.mode != 'RGB':
                img = img.convert('RGB')
            
            # Generate icons for each density
            for folder, size in sizes.items():
                output_dir = os.path.join(base_dir, folder)
                
                # Create directory if it doesn't exist
                os.makedirs(output_dir, exist_ok=True)
                
                # Resize image with high quality
                resized = img.resize((size, size), Image.Resampling.LANCZOS)
                
                # Save as PNG with high quality
                output_path = os.path.join(output_dir, 'ic_launcher.png')
                resized.save(output_path, 'PNG', optimize=True, quality=95)
                file_size = os.path.getsize(output_path)
                print(f"Created: {output_path} ({size}x{size}) - {file_size} bytes")
                
                # Also create round version (same image for now)
                round_output_path = os.path.join(output_dir, 'ic_launcher_round.png')
                resized.save(round_output_path, 'PNG', optimize=True, quality=95)
                file_size = os.path.getsize(round_output_path)
                print(f"Created: {round_output_path} ({size}x{size}) - {file_size} bytes")
                
                # Create foreground version for adaptive icons (slightly smaller with padding)
                # For adaptive icons, we need some padding around the main icon
                foreground_size = int(size * 0.7)  # 70% of the full size for padding
                padding = (size - foreground_size) // 2
                
                # Create a transparent background
                foreground_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
                
                # Resize the original and paste it centered
                fg_resized = resized.resize((foreground_size, foreground_size), Image.Resampling.LANCZOS)
                foreground_img.paste(fg_resized, (padding, padding))
                
                foreground_output_path = os.path.join(output_dir, 'ic_launcher_foreground.png')
                foreground_img.save(foreground_output_path, 'PNG', optimize=True, quality=95)
                file_size = os.path.getsize(foreground_output_path)
                print(f"Created: {foreground_output_path} ({size}x{size} with padding) - {file_size} bytes")
        
        print("Icon conversion completed successfully!")
        
    except FileNotFoundError:
        print(f"Error: Could not find source icon at {source_icon}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    resize_icon()