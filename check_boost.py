with open('index.html','r',encoding='utf-8') as f: c=f.read()
idx=c.find("BOOST_USED")
print(repr(c[idx:idx+700]))
