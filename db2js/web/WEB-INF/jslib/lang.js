/*******************************************************************************
 * The MIT License (MIT)
 * Copyright © 2015 Inshua,inshua@gmail.com, All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the “Software”), to deal in the Software without restriction,
 * including without limitation the rights to use, copy, modify, merge, publish, distribute,
 * sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all copies or substantial
 * portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING
 * BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES
 * OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *******************************************************************************/
// ================= 扩充函数 ========================
/**
 * <pre>
 * 根据判据函数查找满足条件的序号。如果没有找到返回 -1。
 * 用法:
 * <pre class="code">
 * [1, 2, 3, 4].find(function(item, index){
 * 		return item % 2 == 0;
 * });
 * </pre>
 * 得到 1。
 * </pre>
 * @param fn function(item, index) { return boolean};
 * @returns {Object}
 */
Array.prototype.findIndex = function(fn, scope){
	for(var i=0; i< this.length; i++){
		if(fn.call(scope, this[i], i)) return i;
	}
	return -1;
};

/**
 * <pre>
 * 根据判据函数查找满足条件的元素。如果没有找到返回 undefined。
 * 用法:
 * <pre class="code">
 * [1, 2, 3, 4].find(function(item, index){
 * 		return item % 2 == 0;
 * });
 * </pre>
 * 得到 2。
 * </pre>
 * @param fn function(item, index) { return boolean};
 * @returns {Number}
 */
Array.prototype.find = function(fn, scope){
	for(var i=0; i< this.length; i++){
		if(fn.call(scope, this[i], i)) return this[i];
	}
};


/**
 * 找出两个数组（集合）的变化。
 * 例如 
 *     [1,2,3].diff([3,4]) 
 * 得到 
 * 	   {appended : [4], removed : [1,2]}
 * @param newArray 新版本的数组
 * @returns {Object} {appended : [], removed : []}
 */
Array.prototype.diff = function(newArray){
	var n = [], r = [];
	for(var i=0; i<this.length; i++){
		if(newArray.indexOf(this[i]) == -1){
			r.push(this[i]);
		}
	}
	for(var i=0; i<newArray.length; i++){
		if(this.indexOf(newArray[i]) == -1){
			n.push(newArray[i]);
		}
	}
	return {appended : n, removed : r};
}

/**
 * 去除数组中所有相同的元素,得到新数组
 */
Array.prototype.distinct = function(){
	var arr = [];
	for(var i=0; i<this.length; i++){
		if(arr.indexOf(this[i]) == -1){
			arr.push(this[i]);
		}
	}
	return arr;
}

///**
// * 将当前对象与另一对象合并，另一对象的属性复制到本对象。
// * @param b 另一对象
// * @param override 仅复制本对象没有的属性。
// * @returns {Object} 当前对象本身
// */
//Object.prototype.merge = function(b, override){
//	for(var k in b){
//		if(override != false || k in this == false){
//			this[k] = b[k];
//		}
//	}
//	return this;
//};

if(!String.prototype.trim){
	String.prototype.trim = function() {
		return this.replace(/^\s+|\s+$/g, '');
	};
}

String.prototype.contains = function(t) { 
	return this.indexOf(t) >= 0; 
};

/**
 * <pre>
 * 格式化字符串。
 * Usage:
 * <pre class="code">
 *   alert('Program: {key1} {key2}'.format({ 'key1' : 'Hello', 'key2' : 'World' }));
 * </pre>
 * </pre> 
 * @param values
 * @returns
 */
String.prototype.format = function (values) {

    var regex = /\{([\w-]+)(?:\:([\w\.]*)(?:\((.*?)?\))?)?\}/g;

    var getValue = function (key) {
            if (values == null || typeof values === 'undefined') return null;

            var value = values[key];
            var type = typeof value;

            return type === 'string' || type === 'number' ? value : null;
        };

    return this.replace(regex, function (match) {
        //match will look like {sample-match}
        //key will be 'sample-match';
        var key = match.substr(1, match.length - 2);

        var value = getValue(key);

        return value != null ? value : match;
    });
};

/**
 * 通过排序得到的新数组
 * @param fn 排序函数，与 Array.prototype.sort 同
 * @param scope 传入的 this 对象
 * @returns
 */
Array.prototype.orderBy = function(fn, scope) {
	var result = this.slice();
	result.sort(function(){fn.apply(scope, arguments);});
	return result;
};


/**
 * @type
 * 表示失败的错误
 */
function FailedError(message){
	this.name = 'FailedError';		
	this.message = message;
}

/**
 * @type
 * 表示致命错误的错误
 */
function FatalError(message){
	this.name = 'FatalError';
	this.message = message;
}

/**
 * @type
 * 校验错误
 */
function ValidationError(field, validator, message){
	this.name = 'ValidationError';
	this.field = field;
	this.validator = validator;
	this.message = message;
}

var Throwable = Java.type('java.lang.Throwable'), 
	ScriptException = Java.type('javax.script.ScriptException'),
	ECMAException = Java.type('jdk.nashorn.internal.runtime.ECMAException');
/**
 * 将 js 错误包装为可用的 java 错误, 以便在 logger.error(msg, warpJsError(error)) 中使用
 * @param e
 * @returns
 */
function wrapJsError(e){
	return new ECMAException(e, null);
}

/**
 * 对对象的属性名做映射, 得到一个新对象. 
 * 如  translateObject({name : 'Mike', gendor : 'M'}, ['name', 'gender'], ['姓名', '性别']) 得到 {姓名 : 'Mike', 性别 :'M'}
 * @param obj 原对象
 * @param originAttrs 原属性名列表, 数组
 * @param map 映射后的属性名列表, 数组
 */
function translateObject(obj, originAttrs, map){
	var result = {};
	for(var i=0; i< originAttrs.length; i++){
		result[map[i]] = obj[originAttrs[i]];
	}
	return result;
}
