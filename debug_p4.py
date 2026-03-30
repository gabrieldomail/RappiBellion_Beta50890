with open('index.html','r',encoding='utf-8') as f:
    c = f.read()
needle = "rivalScoreRef.on('value'"
idx = c.find(needle)
chunk = c[idx-8:idx+420]
print(repr(chunk))
