import json

data1 = {"content": "A\r\nB"}
data2 = {"content": "A\nB"}
dstr1 = json.dumps(data1)
dstr2 = json.dumps(data2)

obj1 = json.loads(dstr1)
obj2 = json.loads(dstr2)

print("Equal?", obj1 == obj2)
