# Conforming Input Logic

Input logic usually follows an escapable sequence, such as: 
1. check id.  Escape if not valid
2. check email

This tool allows a shortcut method for putting filter and validating functions in escapble sequences.

It is modelled after https://github.com/grithin/php-conform#rule-item-prefixes , but I decided to change the separation styles:
-	`|` used for separating functions
-	`:` used for separating a function from parameters
-	`,` used for separating parameters


## Example


```ts
//+ { prep work
import Conform from '@headhr/conform'

const delayed_promise = (v: any = false) => {
	return new Promise((resolve) => { setTimeout((() => { resolve(v) }), 200) })
}


const conformer = {
	mutate: function (v) {
		return v + 'bob';
	},
	delay_mutate: function (v) {
		const delayed_promise = (v: any = false) => {
			return new Promise((resolve) => { setTimeout((() => { resolve(v) }), 200) })
		}
		return delayed_promise(v + 'bob')
	},
	reject: function (v) {
		throw  {message:'fail'};
		// throw new Error('fail');
	}
}
//+ }


// three ways to set up conformers
let conform = new Conform({}, { conformers: { c: conformer } })
conform.addConformer('c', conformer)
conform.conformers.c = conformer

// two ways to set input
let input = { 'name': 'bob', 'age': '123' }
conform = new Conform(input)
conform.input = input

conform.conformers.c = conformer

// running rules
let rule_runner = async () => {
	let rules = { name: 'c.mutate | c.delay_mutate' }
	let output = await conform.get(rules)
	console.log(output)
}

rule_runner()
/*>
{name: 'bobbobbob'}
*/

// errors
rule_runner = async () => {
	let rules = { name: 'c.reject' }
	let output = await conform.get(rules)
	console.log(output)
	// field remains whatever it was prior to the error
	/*>
	{ name: 'bob' }
	*/
	console.log(conform.errors)
	/*
	[ { e: // the thrown error
		field: 'name',
		rule: { flags: { }, params: [], fn_path: 'c.reject' }
	} ]
	*/
	console.log(conform.field_errors.name)
	/*
	{ e: // the thrown error
		field: 'name',
		rule: { flags: { }, params: [], fn_path: 'c.reject' }
	}
	*/
}
rule_runner()

// only breaking errors prevent output from containing the field
rule_runner = async () => {
	let rules = { name: '!c.reject' }
	let output = await conform.get(rules)
	console.log(output)
	// field remains whatever it was prior to the error
	/*>
	{}
	*/
}
rule_runner()
```


## Errors
In JS you can throw an object
```js
throw {message:'fail', fields:['name', 'id']};
```
Doing it this way you can include other details besides the error message