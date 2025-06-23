// Test file for semicolon checking logic

// These should NOT trigger warnings (have semicolons):
var i = 1; // find end of title and grab
let name = "John"; // user's name
const count = 42; // total items
return result; // return the value
console.log("hello"); // debug output

// These should NOT trigger warnings (control structures):
if (condition) {
  console.log("test");
}

for (let i = 0; i < 10; i++) {
  console.log(i);
}

while (condition) {
  doSomething();
}

function myFunction() {
  return true;
}

try {
  doSomething();
} catch (error) {
  console.log(error);
} finally {
  cleanup();
}

// These should NOT trigger warnings (multi-line objects):
const obj = {
  name: "test",
  value: 42,
  items: [1, 2, 3]
};

docs.push({
  id: doc.id,
  title: doc.title,
  url: doc.url,
  summary: doc.summary
});

// These should NOT trigger warnings (arrays):
const array = [
  "item1",
  "item2",
  "item3"
];

// These should NOT trigger warnings (function calls with multi-line args):
someFunction(
  param1,
  param2,
  param3
);

// These SHOULD trigger warnings (missing semicolons):
var x = 5
let y = 10
const z = 15
return value
console.log("missing semicolon")
myFunction()

// These should NOT trigger warnings (just comments):
// This is a comment
/* This is a block comment */

// These should NOT trigger warnings (closing brackets):
}
)
]