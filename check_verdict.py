with open('index.html','r',encoding='utf-8') as f: c=f.read()
idx = c.find('#fp-verdict {')
print(repr(c[idx:idx+600]))
