from PIL import Image

input_path = r"C:\Users\y.antar\.gemini\antigravity\brain\02627c77-a8a1-4f8c-b115-af82ec1b7695\leadhunter_logo_new_1782224016928.png"
output_path = r"C:\LeadHunter-Pro-AI\LeadHunter.ico"

try:
    img = Image.open(input_path).convert("RGBA")
    data = img.getdata()

    # Create new data where white pixels (and near-white) become transparent
    new_data = []
    for item in data:
        # Check if the pixel is white or very light (e.g., > 240 for R, G, B)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
    
    img.putdata(new_data)
    
    # Save as ICO
    img.save(output_path, format="ICO", sizes=[(256, 256)])
    print("Transparent icon generated successfully at", output_path)
except Exception as e:
    print("Error:", e)
