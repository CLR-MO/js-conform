import _ from '@headhr/lodash'



/** A non error packed with information used for escaping try blocks */
/**
To allow for miscellaneous data, Proxy is used to point members back to this.data (instead of doing a for loop and assigned this.PROP to each)
 */
class Skip {
	data
	message
	type
	note
	constructor(data) {
		this.data = data
		return new Proxy(this, this)
	}
	get(target, prop, receiver) {
		if (prop == 'extract') {
			return this.extract
		}
		return this.data[prop]
	}
	extract = () => {
		return this.data
	}
}

/*
function|function:arg1,arg2


rule format
-	string only: `prefix + fn_path + '|' + param1 + ';' + param2`
-	flexible parameters: `[prefix + fn_path`, param1, param2,...]`
-	anonymous function: `[[prefix, fn], param1, param2,...]`
-	Function Input
		-	`(value, param1,...paramN, {field, instance, input, output})` obj w/ field and instance is appended to param list. Consequently, function should have a fixed number of parameters, so as not to confuse context obj with a parameter
		-	the instance, having a map of the input, can be changed within the function, but the current field value does not depend upon the instance `@input`.  Instead, it depends only upon the previous return values.  You can, however, affect the intial value of subsequent fields by changing `@input`
-	Function output
		-	always return the value, even if not modified
		-	throw an error if validation failed
compbiled rule ex
		rule =
			flags:
				not: true
				optional: true
				break: true
				break_all: true
				continuity: true
				full_continuity: true
			fn_path: ''
			params: []
Uses `Skip` for conform errors
*/
var was;



export default class Conform {
	input
	errors
	field_errors
	output
	conformers
	constructor(input = {}, options: { [key: string]: any } = {}) {
		this.reset()
		this.input = _.cloneDeep(input)
		if (options.conformers) {
			this.conformers = options.conformers
		}else{
			this.conformers = {}
		}
	}
	addConformer (key, conformer){
		this.conformers[key] = conformer
	}
	reset = ()=>{
		this.field_errors = {}
		this.errors = []
		this.output = {}
	}
	/*
	@RETURN	the conformed input.  If there was an error, it will still return the conformed input up until the point where the error stopped the conformaiton.
	@NOTE	to determine if there was an error, use the `conform` instance; either `conform.errors` or `conform.field_errors.FIELD_NAME`
	*/
	get = async (field_map) => {
		this.reset()
		var field, output, promise_fns, rules;
		promise_fns = [];
		// attach `output` to `this` so subsequent field rulesets can access new formatted values
		this.output = output = {};
		for (field in field_map) {
			rules = field_map[field];
			((field, rules) => {
				return promise_fns.push(() => {
					rules = this.compile_rules(rules);
					return this.apply_rules(field, rules).then(function (v) {
						return output[field] = v;
					}).catch(function (e) {
						if (e.type === 'break field') { // expected in normal operation
							return;
						}
						throw e;
					});
				});
			})(field, rules);
		}
		try {
			// load all the conform/validation functions, one after the other, and return output
			for (const fn of promise_fns) {
				await fn()
			}
			return output
		} catch (e) {
			if (e.type === 'break all') { // expected in normal operation
				return output;
			}
			throw e;
		}
	}
	field_rules = (field, rules) => {
		rules = this.compile_rules(rules);
		return this.apply_rules(field, rules);
	}
	compile_rules = (rules) => {
		var compiled_rules, i, len, rule;
		compiled_rules = [];
		if (_.isString(rules)) {
			rules = rules.split(/\s*[\|]\s*/);
			rules = _.remove(rules); // remove empty rules, probably unintended by spacing after or before
		}
		for (i = 0, len = rules.length; i < len; i++) {
			rule = rules[i];
			compiled_rules.push(this.compile_rule(rule));
		}
		return compiled_rules;
	}

	compile_rule = (rule) => {
		var parsed_rule, rule_obj;
		rule_obj = {};
		if (_.isString(rule)) {
			parsed_rule = this.parse_rule_text(rule);
			rule_obj.flags = this.parse_flags(parsed_rule.flag_string);
			rule_obj.params = this.parse_params(parsed_rule.params_string);
			rule_obj.fn_path = parsed_rule.fn_path;
			return rule_obj;
		} else if (_.isArray(rule)) {
			if (_.isString(rule[0])) {
				parsed_rule = this.parse_rule_text(rule[0]);
				rule_obj.flags = this.parse_flags(parsed_rule.flag_string);
				rule_obj.fn_path = parsed_rule.fn_path;
			} else if (_.isArray(rule[0])) {
				rule_obj.flags = this.parse_flags(rule[0][0]);
				rule_obj.fn_path = rule[0][1];
			} else {
				throw new Skip({
					message: 'Non conforming rule',
					rule: rule
				});
			}
			rule_obj.params = rule.slice(1);
			return rule_obj;
		}
	}
	apply_rules = async (field, rules) => {
		var i, len, promise_fns, rule, value;
		value = _.get(this.input, field);
		this.field_errors[field] = this.field_errors[field] || [];
		promise_fns = [];
		for (i = 0, len = rules.length; i < len; i++) {
			rule = rules[i];
			((rule) => {
				var catch_fn;
				catch_fn = (e, value) => {
					var error;
					if (rule.flags.not && e.type !== 'not') { // potentially, the not flag caused the Error
						return value; // must return the value so the sequence can continue with last-value
					}
					if (!rule.flags.optional) {
						error = {
							e: e,
							field: field,
							rule: rule
						};
						this.field_errors[field].push(error);
						this.errors.push(error);
					}
					if (rule.flags.break) {
						throw new Skip({
							type: 'break field'
						});
					}
					if (rule.flags.break_all) {
						throw new Skip({
							type: 'break all'
						});
					}
					return value; // rule was optional and non-breaking.  Return value for last-value on next rule
				};
				return promise_fns.push(async (value) => {
					var fn;
					// handle continuity
					if (rule.flags.continuity && this.field_errors[field].length) {
						throw new Skip({
							type: 'break field'
						});
					} else if (rule.flags.full_continuity && this.errors.length) {
						throw new Skip({
							type: 'break field'
						});
					}
					// resolve and try function
					fn = this.resolve_fn(rule.fn_path);
					fn = _.partial.apply(_, [fn].concat([value].concat(rule.params))); // prefix fn with parameters
					fn = _.partialRight(fn, {
						field: field,
						instance: this,
						input: this.input,
						output: this.output // affix fn with context
					});
					
					let v
					try {
						v = await fn()
						if (rule.flags.not) {
							throw new Skip({
								type: 'not'
							});
						}
						return v
					} catch (e) {
						return catch_fn(e, value)
					}
				});
			})(rule);
		}
		for (const fn of promise_fns) {
			value = await fn(value)
		}
		return value
	}
	resolve_fn = (fn_path) => {
		var fn;
		fn = _.get(this.conformers, fn_path);
		if (!_.isFunction(fn)) {
			throw new Error('rule fn not a fn: ' + fn_path);
		}
		return fn;
	}
	parse_rule_text = (text) => {
		var match;
		match = text.match(/(^[^_a-z]+)?([^:]+)(\:(.*))?/i);
		if (!match) {
			throw new Error('Rule text not conforming: "' + text + '"');
		}
		return {
			flag_string: match[1],
			fn_path: match[2],
			params_string: match[4]
		};
	}
	// @return always array
	parse_params = (params_string) => {
		return params_string && params_string.split(',') || [];
	}
	parse_flags = (flag_string) => {
		var char, flags, i, len;
		if (!flag_string) {
			return {};
		}
		// handle 2 char flags
		flags = {};
		if (flag_string.match(/\!\!/)) {
			flags.break_all = true;
			flag_string = flag_string.replace(/\!\!/);
		}
		if (flag_string.match(/\&\&/)) {
			flags.full_continuity = true;
			flag_string = flag_string.replace(/\&\&/);
		}
		for (i = 0, len = flag_string.length; i < len; i++) {
			char = flag_string[i];
			switch (char) {
				case '?':
					flags.optional = true;
					break;
				case '!':
					flags.break = true;
					break;
				case '&':
					flags.continuity = true;
					break;
				case '~':
					flags.not = true;
			}
		}
		return flags;
	}
	
	transform_falses = (obj) => {
		var new_obj;
		new_obj = {};
		_.each(obj, (fn, k) => {
			if (_.isFunction(fn)) {
				return new_obj[k] = this.transform_false(fn);
			}
		});
		return new_obj;
	}
	transform_false = async (fn) => {
		return function () {
			var value;
			value = arguments[0];

			const args_without_context = Array.from(arguments).slice(0, -1)
			let result = fn.apply(null, args_without_context)

			let clear_promises = async() =>{
				while (_.is_promise(result)) {
					result = await result
				}
				// false indicates error
				if (!result) {
					throw new Skip({
						note: 'transformed false function'
					});
				}
				// result was true, so pass the input value on
				return value;
			}
			return clear_promises()
			
			
		};
	}
	standardise_errors = (errors) => {
		var error, formed, formed_errors, i, len;
		errors = errors || this.errors;
		formed_errors = [];
		// error = {e:e, field:field, rule:rule}
		// e being some thrown error, potentially a Skip or Error object
		for (i = 0, len = errors.length; i < len; i++) {
			error = errors[i];
			// special handling of not-ed rules
			if (error.e instanceof Skip && error.e.type === 'not') {
				formed = {
					type: '~' + error.rule.fn_path
				};
			} else {
				if (error.e instanceof Skip) { // assume thrown Skip contains expected attributes (message, etc)
					formed = error.e.extract();
				} else {
					formed = {
						message: error.e.message
					};
					if(error.e.fields){
						formed.fields = error.e.fields
					}
					if (error.e.field) {
						formed.fields = [error.e.field]
					}
				}
			}
			// apply defaults
			formed = _.defaults(formed, {
				fields: [error.field],
				type: error.rule.fn_path,
				params: error.rule.params
			});
			if (!formed.message) {
				formed.message = formed.type;
			}
			formed_errors.push(formed);
		}
		return formed_errors;
	}
}
