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
// ================= DBJS 公共函数 ========================
function $INT(o){ return {'INT' : Math.floor(o)};}
function $LONG(o){ return {'LONG' : Math.floor(o)};}
function $DOUBLE(o){ return {'DOUBLE' : o * 1};}
function $FLOAT(o){ return {'FLOAT' : o * 1};}
function $DECIMAL(o){ return {'DECIMAL' : o * 1};}
function $BINARY(o){ return {'BINARY' : o};}
function $DATE(o){ return {'DATE' : o};}
function $TIME(o){ return {'TIME' : o};}
function $STRING(o){ return {'STRING' : o + ''};}
function $BOOLEAN(o){ return {'BOOLEAN' : o ? true : false};}
function $OUTCURSOR(o){return {'OUTCURSOR' : o};}
function $ARRAY(type, o){ return {'ARRAY' : [type].concat(o)};}
function $JSONB(o){ return {'JSONB' : o}; }
function $JSON(o){ return {'JSON' : o}; }
/**
 * <pre>
 * 输出参数. 存储过程输出时用. 由于存储过程输出参数必须明确 JDBC 类型, 必须使用该函数封包. 
 * 用法:
 * <pre class="code">
 * 	var p = $OUTP('INTEGER', 1);		// 提供参数值为 1 的一个参数
 *	var p2 = $OUTP('VARCHAR', $STRING('hello world'));
 * 	dbjs.call('testpkg.test(?, ?)', [p, p2]);
 *	println(p.result);
 *	println(p2.result);  
 * </pre>
 * </pre>
 * @param jdbcType string jdbc 类型, java.sql.Types 成员, 如 INT CHAR NCHAR
 * @param inValue 可选. 纯 OUT 参数可不提供. IN OUT 型参数时提供, 可推导类型的基本类型数据, 或带有类型声明的元组
 * @returns {OUT : true, JDBC_TYPE: jdbcType, VALUE : o}
 */
function $OUTP(jdbcType, inValue){
	if(jdbcType in java.sql.Types){
		var type = java.sql.Types[jdbcType];
		return {OUT : true, JDBC_TYPE: type, VALUE : inValue};
	} else {
		throw new Error(jdbcType + ' not in java.sql.Types');
	}
}

/**
 * 在构造 SQL 语句时, 将该参数直接变为 SQL 语句的一部分. 
 * 仅用于构造 SQL 的场景. 如 insertRow, updateRow, deleteRow, deleteRows, mergeRow.
 * 不可用于 execute, query 场景  
 * @param sql SQL 语句片段, 如 seq.nextval
 */
function $SQL(sql){
	return {SQL : sql};
}
/**
 * 该类一般会自动调用 init 函数初始化，只需要使用 dbjs 或 handler 对象。<p>
 * 对于 *.dbjs 脚本，只要扩充 dbjs 或 hanlder 对象，给它插入新的方法即可。 <p>
 * 对于 *.dbjs 脚本，增删改查几个方法规格如下：
 * <pre class="code">
 * dbjs.fetch = function(params){
 * 		...
 *		return this.query(sql, params, params._page);
 * };
 * dbjs.create = function(params, rcd){
 *		rcd.id = this.nextId('SEQ_ENTITY');
 *		this.insertRow('表名', rcd);
 *	};
 *
 * dbjs.modify = function(params, rcd){
 *		this.updateRow('表名', rcd);
 * };
 * dbjs.destroy = function(params, rcd){	
 * 		this.deleteRow('表名', rcd);
 * };	
 * </pre>
 * @class DBJS
 */
function DBJS(sqlExecutor){ this.sqlExecutor = sqlExecutor;  }

DBJS.prototype = new Object();

DBJS.prototype.constructor = DBJS;

DBJS.prototype.transactConnection = null;	// for transaction;

/**
 * <pre>
 *  执行SQL查询语句，返回查询结果集。
 *  对于不带参数的 sql 语句，args 可以不填， 如
 *  	this.query('select * from test where id > 2');
 *  
 *  对于含参数的 sql 语句，有三种书写方法：
 *  1. 使用 ? 给参数占位，此时应提供参数数组。如
 *  <pre class="code">
 *  	this.query('select * from test where id > ?', [2]);
 *  	this.query('select * from test where id > ? and instr(name, ?) > 0', [{INT : 2}, 'Jo']);
 *  </pre>
 *  
 *  2. 使用命名参数，使用 :argname 为参数占位。此时应提供命名元组作为参数集合。如
 *  <pre class="code">
 *  	this.query('select * from test where id > :id', {id : 2});
 *  	this.query('select * from test where id > :id and instr(name, :name) > 0', {id : {INT : 2}, name : 'Jo'});
 *  </pre>
 *  
 *  3. 使用内嵌表达式。在 SQL 中，使用 {} 将 js 代码直接嵌入。此时参数提供一个带有上下文环境的求值函数。如
 *  <pre class="code">
 *  	var a = 2, name = 'Jo';
 *  	var evaler = function(s){return eval(s);};
 *  	this.query('select * from test where id > {a}', evaler);
 *  	this.query('select * from test where id > {a} and instr(name, {name}) > 0', evaler);
 *  </pre>
 *  
 *  由上，参数可以是一个简单值，由程序自动推导类型，也可以使用 {类型 : 值} 的方式明确指定类型，可以使用的类型有: 
 *  <pre class="code">
 *  	INT LONG DOUBLE FLOAT DECIMAL BOOLEAN BINARY STRING DATE TIME OUTCURSOR ARRAY。
 *  </pre>
 *  其中，
 *  <pre class="code">
 *  	BINARY 参数的值可以使用 BYTE 数组或 BASE64 字符串
 *  	DATE 参数的值可以 js 日期时间、 ISO 毫秒数、及格式为 yyyy-MM-dd HH:mm:ss 的日期字符串
 *  	TIME 参数的值可以 js 日期时间、 ISO 毫秒数、及格式为 HH:mm:ss 的日期字符串
 *  	OUTCURSOR 用于接收存储过程的输出游标，详见存储过程。
 *  	ARRAY 可以传递数组，视数据库的实现，应该使用数据库类型指定的类型作为第一个元素，如需要传递 [1,2,3]，对 pg 应传递 {ARRAY: ['int4', 1, 2, 3]}，或使用 $ARRAY('int4', [1,2,3])
 *  </pre>
 *  除了 {类型 : 值}，也提供了一组函数生成这样的参数，函数调用如 $INT(value)，得到 {INT : value}，与类型对应有如下函数
 *  <pre class="code">
 *  	$INT $LONG $DOUBLE $FLOAT $DECIMAL $BOOLEAN $BINARY $STRING $DATE $TIME $OUTCURSOR $ARRAY。
 *  </pre>
 *  
 *  查询结果集定义如下：
 *  <pre class="code">
 *  	{columns : [列, ..], rows : [行, ...]}
 *  		列 : {name : 列名, type : 数据类型}		数据类型取值范围与参数的数据类型一致
 *  		行 : {列名 : 值, ...}
 *  </pre>
 *  </pre>
 *	@param sql string sql语句，不要 ;
 *	@param args null|array|eval function|named args 可以使用命名参数和内嵌表达式。
 *  @param pageDef {start : <<起点,第几条,从0开始>>, limit : 条数}
 */
DBJS.prototype.query = function(sql, args, pageDef){
	if(!sql.charAt) sql = sql + '';
	if(args == null) {
		args = [];
	} else if(args instanceof Array){
		
	} else if(typeof args == 'object'){
		var parsed = parseNamedArgsSql(sql, args);
		sql = parsed.sql;
		args = parsed.args;
	} else if(typeof args == 'function'){
		var evalIt = args;
		var parsed = parseSqlExpr(sql, evalIt);
		sql = parsed.sql;
		args = parsed.args;
	} else {
		throw new Error('unknown args ' + JSON.stringify(args));
	}
	
	if(pageDef){
		if(typeof pageDef == 'string'){
			pageDef = JSON.parse(pageDef, parseDate);
		}
		if(logger && logger.isDebugEnabled()) logger.debug("do page query " + sql + " with args: " + JSON.stringify(args));
		return this.sqlExecutor.pageQuery(this.transactConnection||null, sql,pageDef.start, pageDef.limit, args) 
	} else {
		if(logger && logger.isDebugEnabled()) logger.debug("do query " + sql + " with args: " + JSON.stringify(args));
		return this.sqlExecutor.query(this.transactConnection || null, sql, args, true);
	}
} ;

/**
 * <pre>
 * 	 与 query 类似, 但使用的是游标方式, 可以提供遍历函数, 逐行提取单行结果, 该方式不支持分页.
 * </pre>
 *	@param sql string sql语句，不要 ;
 *	@param args null|array|eval function|named args 可以使用命名参数和内嵌表达式。
 *  @param traveler function(row, columns){ } : true|false, 返回 true 停止遍历
 */
DBJS.prototype.travel = function(sql, args, traveler){
	if(!sql.charAt) sql = sql + '';
	if(args == null) {
		args = [];
	} else if(args instanceof Array){
		
	} else if(typeof args == 'object'){
		var parsed = parseNamedArgsSql(sql, args);
		sql = parsed.sql;
		args = parsed.args;
	} else if(typeof args == 'function'){
		var evalIt = args;
		var parsed = parseSqlExpr(sql, evalIt);
		sql = parsed.sql;
		args = parsed.args;
	} else {
		throw new Error('unknown args ' + JSON.stringify(args));
	}
	
	if(logger && logger.isDebugEnabled()) logger.debug("travel " + sql + " with args: " + JSON.stringify(args));
	this.sqlExecutor.travel(this.transactConnection||null,sql, args, traveler);
} ;

/**
 * <pre>
 *  给 sql 查询追加 order by 语句。
 *  usage : sql = this.sort(params._sorts);
 *  </pre>
 *	@param sql string sql语句，不要 ;
 *	@param sorts {fld1: 'asc' | 'desc', fld2 : 'asc' | 'desc'} 靠前的规则排序靠前
 *  @param defaultSorts 默认排序规则。与 sorts 定义相同。
 */
DBJS.prototype.orderBy = DBJS.prototype.appendSort = function(sql, sorts, defaultSorts){
	sorts = sorts || defaultSorts;
	
	var arr = [];
	if(sorts){
		for(var k in sorts){
			if(sorts.hasOwnProperty(k)){
				arr.push(k + ' ' + sorts[k]);
			}
		}
		if(arr.length) sql += ' ORDER BY ' + arr.join();
	}
	return sql;
};

/**
 * 查询单行. 
 * @param sql 同 query
 * @param args 同 query
 * @returns
 */
DBJS.prototype.queryRow = function(sql, args){
	return DBJS.prototype.query.apply(this, arguments).rows[0]; 
};

/**
 * 查询单值
 * @param sql
 * @param args
 * @returns
 */
DBJS.prototype.queryScalar = function(sql, args){
	var row = DBJS.prototype.queryRow.apply(this, arguments);
	if(row){
		for(var k in row){
			if(row.hasOwnProperty(k)){
				return row[k];
			}
		}
	}
};



/**
 *  执行SQL语句。
 *	@param sql string sql语句，不要 ;
 *	@param args null|array|eval function|named args 像 query 一样，可以使用命名参数和内嵌表达式。
 */
DBJS.prototype.execute = function(sql, args){
	if(!sql.charAt) sql = sql + '';
	if(args == null) {
		args = [];
	} else if(args instanceof Array){
		
	} else if(typeof args == 'object'){
		var parsed = parseNamedArgsSql(sql, args);
		sql = parsed.sql;
		args = parsed.args;
	} else if(typeof args == 'function'){
		var evalIt = args;
		var parsed = parseSqlExpr(sql, evalIt);
		sql = parsed.sql;
		args = parsed.args;
	} else {
		throw new Error('unknown args ' + JSON.stringify(args));
	}
	
	if(logger && logger.isDebugEnabled()) logger.debug("execute " + sql + " with args: " + JSON.stringify(args));
	return this.sqlExecutor.execute(this.transactConnection||null, sql, args);
}; 

/**
 * <pre>
 *  调用存储过程。
 *  如存储过程用到输出游标，对应参数可填入 {OUTCUSOR : out}, out 定义为 var out = {}，存储过程执行后， out 即已填充为查询结果集。
 *  如参数需要输出值, 可以使用 $OUTP() 将参数引起来, 详见 $OUTP 的说明.
 * </pre>
 *	@param callProcStmt string 包名.存储过程(?, ?, ...) 或 存储过程(?, ?, ...)。同样支持命名方式和嵌入表达式方式。
 *	@param args null|array|eval function|named args 像 query 一样，可以使用命名参数和内嵌表达式。
 */
DBJS.prototype.call = function(callProcStmt, args){
	var sql = callProcStmt;
	if(!sql.charAt) sql = sql + '';
	if(args == null) {
		args = [];
	} else if(args instanceof Array){
		
	} else if(typeof args == 'object'){
		var parsed = parseNamedArgsSql(sql, args);
		sql = parsed.sql;
		args = parsed.args;
	} else if(typeof args == 'function'){
		var evalIt = args;
		var parsed = parseSqlExpr(sql, evalIt);
		sql = parsed.sql;
		args = parsed.args;
	} else {
		throw new Error('unknown args ' + JSON.stringify(args));
	}
	if(logger && logger.isDebugEnabled()) logger.debug("call " + sql + " with args: " + JSON.stringify(args));
	return this.sqlExecutor.call(this.transactConnection||null,sql, args);
}; 

/**
 * 取序列的下一个序号
 * @seq string 序列名
 */
DBJS.prototype.nextId = function(seq){
	if(this.sqlExecutor.isOracle()){
		var r = this.query('select ' + seq + '.nextval n from dual', []);
	} else if(this.sqlExecutor.isPostgreSQL()){
		var r = this.query("select nextval('" + seq +"') n", []);
	}
	return r.rows[0].n;
};

/**
 * <pre>
 *  插入单行, 已规避主键字段值已经存在的行
 *	如果能提供字段列表，尽量提供。字段列表的格式使用查询结果返回的格式，即 [{name : '字段名', type : '类型'}, ...]，或使用 ['字段名1','字段名2',...]。
 *	如果不能提供字段列表，需要保证 row 中的各个自定义属性都是数据库字段
 *	调用函数前使用  row.id = this.nextId() 得到下一个主键id
 *</pre>
 *	@param table string 表名
 *	@param row {columnName : value, ...} 
 *	@param columns 可选,[{name : 字段名, type : 类型}, ...] 或 ['字段名1','字段名2',...] 字段列表, 不提供时取所有 row 的属性
 *  @param pkColumn 主键字段, 可选, 默认为 id 
 */
DBJS.prototype.insertRow = function(table, row, columns, pkColumn){
	pkColumn = pkColumn||'id';
	var insertPart = new java.lang.StringBuffer('INSERT INTO ' + table + '(');
	var valuesPart = new java.lang.StringBuffer(' SELECT ');
	var args = [];
	if(columns == null){
		columns = [];
		for(var k in row){
			if(row.hasOwnProperty(k)){
				columns.push(k);
			}
		}
	}
	for(var i=0; i<columns.length; i++){
		var col = columns[i];
		insertPart.append(col.name || col);
		
		var value = row[col.name || col];
		if(value && value.SQL){
			valuesPart.append(value.SQL);
		} else {
			valuesPart.append('?');
			if(col.name){
				var arg = {};
				arg[col.type] = row[col.name];
				args.push(arg);
			} else {
				args.push(value);
			}
		}
		
		if(i < columns.length -1){
			insertPart.append(',');
			valuesPart.append(',');
		}		
	}
	insertPart.append(') ');
	if(row[pkColumn] && ! row[pkColumn].SQL){
		if(this.sqlExecutor.isOracle()) {
			valuesPart.append(' FROM DUAL WHERE NOT EXISTS(SELECT 1 FROM ' + table + ' WHERE '+pkColumn+'= ?)');
		} else if(this.sqlExecutor.isPostgreSQL()){
			valuesPart.append(' WHERE NOT EXISTS(SELECT 1 FROM ' + table + ' WHERE '+pkColumn+'= ?)');
		}
		args.push(row[pkColumn]);
	} else {
		if(this.sqlExecutor.isOracle()) {
			valuesPart.append(' FROM DUAL');
		}
	}	
	if(this.sqlExecutor.isPostgreSQL()){
		valuesPart.append(' RETURNING *');
	}
	var sql = insertPart.toString() + valuesPart.toString();
	if(this.sqlExecutor.isPostgreSQL()){
		return this.queryRow(sql, args);
	} else {
		return this.execute(sql, args);
	}
};

/**
 * <pre>
 *  更新单行
 *	如果能提供字段列表，尽量提供。字段列表的格式使用查询结果返回的格式，即 [{name : '字段名', type : '类型'}, ...]，或使用 ['字段名1','字段名2',...]。
 *	如果不能提供字段列表，需要保证 row 中的各个自定义属性都是数据库字段
 * </pre>
 *	@param table string 表名
 *	@param row {columnName : value, ...} 
 *	@param columns 可选,[{name : 字段名, type : 类型}, ...] 或 ['字段名1','字段名2',...] 字段列表, 不提供时取所有 row 的属性
 *  @param pkColumn 主键字段, 可选, 默认为 id 
 */
DBJS.prototype.updateRow = function(table, row, columns, pkColumn){
	pkColumn = pkColumn || 'id';	
	var args = [];
	if(columns == null){
		columns = [];
		for(var k in row){
			if(row.hasOwnProperty(k)){
				columns.push(k);
			}
		}
	}
	
	var sql = new java.lang.StringBuffer('UPDATE ' + table + ' SET ');	
	for(var i=0; i<columns.length; i++){
		var col = columns[i];
		var cname = col.name || col;
		if(pkColumn == cname) continue;
		sql.append(cname).append('=');
		var value = row[cname];
		if(value && value.SQL){
			sql.append(value.SQL);
		} else {
			sql.append('?');
			if(col.name){
				var arg = {};
				arg[col.type] = row[col.name];
				args.push(arg);
			} else {
				args.push(row[col]);
			}
		}
		sql.append(',');
	}
	sql.setLength(sql.length() -1);
	
	sql.append(' WHERE ' + table + '.' + pkColumn + '= ?');
	args.push(row[pkColumn]);
	
	if(this.sqlExecutor.isPostgreSQL()){
		return this.queryRow(sql.toString() + ' RETURNING *', args);
	} else {
		return this.execute(sql.toString(), args);
	}
};

/**
 * <pre>
 *  合并单行. 系 upsert 操作. 使用 merge into 语句.
 *	如果能提供字段列表，尽量提供。字段列表的格式使用查询结果返回的格式，即 [{name : '字段名', type : '类型'}, ...]，或使用 ['字段名1','字段名2',...]。
 *	如果不能提供字段列表，需要保证 row 中的各个自定义属性都是数据库字段
 * </pre>
 *	@param table string 表名
 *	@param row {columnName : value, ...}. 特别说明: 对于由 sequence 产生值的 id 字段, 应使用 $SQL('SEQ.nextval'), 而不要使用 {id : this.nextId('SEQ')}, 避免浪费 SEQ 以及两次访问数据库的开销.
 *	@param uniqueFields 合并依据字段名数组, 通常带有唯一约束, 如只有一个, 可以提供单值而不提供数组. 
 *	@param columns 可选,[{name : 字段名, type : 类型}, ...] 或 ['字段名1','字段名2',...] 字段列表, 不提供时取所有 row 的属性
 *	@param pkColumns 主键字段(不应更新字段). 避免混入更新语句部分, 导致主键字段被更新.
 */
DBJS.prototype.mergeRow = function(table, row, uniqueFields, columns, pkColumns){
	if(columns == null){
		columns = [];
		for(var k in row){
			if(row.hasOwnProperty(k)){
				columns.push(k);
			}
		}
	} 
	if(uniqueFields.map == null) uniqueFields = [uniqueFields]; 
	if(pkColumns && pkColumns.map == null) pkColumns = [pkColumns];
	
	var uniqueColumns = [];
	for(var i=0; i< uniqueFields.length; i++){
		var fld = uniqueFields[i];
		if(columns.indexOf(fld) == -1){
			var col = columns.reduce(function(result, col){
				if(result) return result;
				if(col.name == fld) return col;				
			});
			if(col == null) throw new Error(fld + ' not found in columns');
			uniqueColumns.push(col);
		} else {
			uniqueColumns.push(fld);
		}
	}
	
	if(this.sqlExecutor.isOracle()){
		return this.mergeRowOracle(table, row, uniqueColumns, columns, pkColumns);
	} else {
		return this.mergeRowPostgreSQL(table, row, uniqueColumns, columns, pkColumns);
	}
};

DBJS.prototype.mergeRowOracle = function(table, row, uniqueColumns, columns, pkColumnNames){
	var args = [];
	var uniqueStatement = new java.lang.StringBuffer('(');
	for(var i=0; i< uniqueColumns.length; i++){
		var col = uniqueColumns[i];
		var cname = col.name || col;
		uniqueStatement.append(cname).append('=');
		var value = row[cname];
		if(value && value.SQL){
			uniqueStatement.append(value.SQL);
		} else {
			uniqueStatement.append('?');
			args.push(toTypedArg(col, value));
		}
		if(i < uniqueFields.length -1){
			uniqueStatement.append(' AND ');
		}
	}
	uniqueStatement.append(')');
	
	var updateStatement = new java.lang.StringBuffer('UPDATE SET ');	
	for(var i=0; i<columns.length; i++){
		var col = columns[i];
		var cname = col.name || col;
		if(uniqueColumns.indexOf(col) != -1) continue;						// 命中用的字段只作为条件，不应放入 UPDATE 部分
		if(pkColumnNames && pkColumnNames.indexOf(cname) != -1) continue;	// 其它 UPDATE 应该跳过的字段
		
		updateStatement.append(cname).append('=');
		var value = row[cname];
		if(value && value.SQL){
			updateStatement.append(value.SQL);
		} else {
			updateStatement.append('?');
			args.push(toTypedArg(col, value));
		}
		updateStatement.append(',');
	}
	updateStatement.setLength(updateStatement.length() -1);
	
	var insertPart = new java.lang.StringBuffer('INSERT (');
	var valuesPart = new java.lang.StringBuffer('VALUES (');
	for(var i=0; i<columns.length; i++){		// 所有字段都应放入 INSERT 部分
		var col = columns[i];
		var cname = col.name || col;
		insertPart.append(cname);
		var value = row[cname];
		if(value && value.SQL){
			valuesPart.append(value.SQL);
		} else {
			valuesPart.append('?');
			args.push(toTypedArg(col, value));
		}
		
		if(i < columns.length -1){
			insertPart.append(',');
			valuesPart.append(',');
		}		
	}
	insertPart.append(') ');
	valuesPart.append(')');	
	
	
	var sql = new java.lang.StringBuffer();
	sql.append('MERGE INTO ').append(table).append(' USING dual ON ').append(uniqueStatement) 
			.append('\r\n\tWHEN MATCHED THEN ').append(updateStatement)
			.append('\r\n\tWHEN NOT MATCHED THEN ').append(insertPart).append(valuesPart);
	
	return this.execute(sql, args);
	
	function toTypedArg(col, value){
		if(col.type){
			var arg = {}; arg[col.type] = value;
			return arg
		} else {
			return value;
		}		
	}
};

DBJS.prototype.mergeRowPostgreSQL = function(table, row, uniqueColumns, columns, pkColumnNames){
	var args = [];
	var vTableStatement = new java.lang.StringBuffer().append('nv(');
	var valuesPart = new java.lang.StringBuffer().append('(');
	for(var i=0; i< uniqueColumns.length; i++){
		var col = uniqueColumns[i];
		var cname = col.name || col;
		vTableStatement.append(cname).append(',');
		var value = row[cname];
		if(value && value.SQL){
			valuesPart.append(value.SQL).append(',');
		} else {
			valuesPart.append('?,');
			args.push(toTypedArg(col, value));
		}		
	}
	// println('vTableStatement ' + vTableStatement);
	vTableStatement.setLength(vTableStatement.length() -1);
	valuesPart.setLength(valuesPart.length() -1);
	vTableStatement.append(')').append(' AS (VALUES ').append(valuesPart).append(')),');	
	
	var updateStatement = new java.lang.StringBuffer('UPDATE ').append(table).append(' t SET ');	
	for(var i=0; i<columns.length; i++){
		var col = columns[i];
		var cname = col.name || col;
		if(uniqueColumns.indexOf(col) != -1) continue;						// 命中用的字段只作为条件，不应放入 UPDATE 部分
		if(pkColumnNames && pkColumnNames.indexOf(cname) != -1) continue;	// 其它 UPDATE 应该跳过的字段
		
		updateStatement.append(cname).append('=');
		var value = row[cname];
		if(value && value.SQL){
			updateStatement.append(value.SQL);
		} else {
			updateStatement.append('?');
			args.push(toTypedArg(col, value));
		}
		updateStatement.append(',');
	}
	updateStatement.setLength(updateStatement.length() -1);
	updateStatement.append(' FROM nv WHERE ');
	for(var i=0; i< uniqueColumns.length; i++){
		var col = uniqueColumns[i];
		var cname = col.name || col;
		if(i > 0) updateStatement.append(' AND ');
		updateStatement.append('t.').append(cname).append('=').append('nv.').append(cname);
	}
	updateStatement.append('\r\n').append('RETURNING t.*');
	
	var insertPart = new java.lang.StringBuffer('INSERT INTO ').append(table).append('(');
	var valuesPart = new java.lang.StringBuffer('SELECT ');
	for(var i=0; i<columns.length; i++){		// 所有字段都应放入 INSERT 部分
		var col = columns[i];
		var cname = col.name || col;
		insertPart.append(cname);
		var value = row[cname];
		if(value && value.SQL){
			valuesPart.append(value.SQL);
		} else {
			valuesPart.append('?');
			args.push(toTypedArg(col, value));
		}
		
		if(i < columns.length -1){
			insertPart.append(',');
			valuesPart.append(',');
		}		
	}
	insertPart.append(') ');
	valuesPart.append(' FROM nv WHERE NOT EXISTS (SELECT 1 FROM upsert up LIMIT 1)');	
	
	
	var sql = new java.lang.StringBuffer();
	sql.append('WITH ').append(vTableStatement).append('\r\n')
		.append('upsert AS (').append('\r\n')
		.append(updateStatement).append(') \r\n')
		.append(insertPart).append(valuesPart);
	
	return this.execute(sql, args);
	
	function toTypedArg(col, value){
		if(col.type){
			var arg = {}; arg[col.type] = value;
			return arg
		} else {
			return value;
		}		
	}
};

/**
 *  删除单行。
 *	@param table string 表名
 *	@param row {columnName : value, ...} 只要有 pkColumn 列即可, 有其它的列也不会造成干扰。
 *  @param pkColumn 主键字段, 可选, 默认为 id 
 */
DBJS.prototype.deleteRow = function(table, row, pkColumn){
	pkColumn  = pkColumn||'id';
	var value = row[pkColumn];
	if(value && value.SQL){
		var sql = 'DELETE FROM ' + table + ' WHERE ' + pkColumn + ' = ' + value.SQL;
		return this.execute(sql, [value]);		
	} else {
		var sql = 'DELETE FROM ' + table + ' WHERE ' + pkColumn + ' = ?';
		return this.execute(sql, [value]);
	}
};

/**
 * 删除符合给定条件的记录
 * @param table 表名
 * @param cond 描述 filed = value 的对象, 如 {id : 1, name : 'John'}, 目前仅支持这种机械匹配, 如不提供 cond 则全部删除
 */
DBJS.prototype.deleteRows = function(table, cond){
	var sql = 'DELETE FROM ' + table;
	var arr = [];
	if(cond){
		sql += ' WHERE ';
		for(var k in cond){
			if(cond.hasOwnProperty(k)){
				var v = cond[k];
				if(v && v.SQL){
					sql += k + ' = ' + v.SQL;
				} else {
					sql += k + ' = ?';
					arr.push(v);
				}
			}
		}
	}
	return this.execute(sql, arr);
};


/**
 * 更新子行
 * @param childrenName 字段名
 * @param masterRcd 父行。应该包含 {<<childrenName>> : [{子行}, ...]} 。 子行应有状态位标记 _state = 'new'|'edit'|'remove'，对应调用函数 create_<<childrenName>>, modify_<<childrenName>>, destroy_<<childrenName>>
 * @param masterId 外键ID的值，也就是 父行.id
 */
DBJS.prototype.updateChildren = function(childrenName, masterRcd, masterId){
	var rows = masterRcd[childrenName];
	for(var i=0; i< rows.length; i++){
		var fun = null;
		var row = rows[i];
		switch(row._state){
		case 'new' :  fun = this['create_' + childrenName]; break;
		case 'remove' : fun = this['destroy_' + childrenName]; break;
		case 'edit' : fun = this['modify_' + childrenName]; break;
		}
		if(fun){
			fun.call(this, {parentId : masterId}, row);
		}
	}
};

function parseSqlExpr(sql, evalIt) {
	var s = '', q = 0, expr = '';
	state = 1;
	var args = [];

	function sql_st() {
		var c = sql.charAt(q++);
		if (c == '')
			return;
		if (c == '{') {
			if (sql.charAt(q) != '{') {
				s += '?';
				expr = '';
				expr_st(arguments.callee);
			} else {
				s += sql.charAt(q++);
				sql_st();
			}
		} else if (c == '}') {
			if (sql.charAt(q) == '}') {
				s += sql.charAt(q++);
				sql_st();
			} else {
				throw new Error('in sql statement } shound writen as }}');
			}
		} else {
			s += c;
			sql_st();
		}
	}
	function expr_st(upSt) {
		var c = sql.charAt(q++);
		if (c == '') {
			throw new Error('expression not complete ' + expr + ' ' + s + ':'
					+ q);
		} else if (c == '}') {
			if (sql.charAt(q) != '}') {
				args.push(evalIt(expr));
				upSt();
			} else {
				expr += sql.charAt(q++);
				expr_st(upSt);
			}
		} else if (c == '{') {
			if (sql.charAt(q) != '{') {
				expr_st(arguments.callee);
			} else {
				expr += sql.charAt(q++);
				expr_st(upSt);
			}
		} else {
			expr += c;
			expr_st(upSt);
		}
	}

	sql_st();

	return {
		sql : s,
		args : args
	};
}

var JsSymbols = '~!@#$%^&*()-+=[]{}\|;:\'",.<>/? \r\n\t';
// handle ('select * from a where id > :id', {id : {INT: 2}})
// dont support nested object, use embbed sql above 
function parseNamedArgsSql(sql, args){
	var s=new java.lang.StringBuffer();
	var inname = false; var name = null;
	var rargs = [];
	for(var i=0; i<sql.length; i++){
		var c = sql[i], n = sql[i+1];
		if(!inname){
			if(c == ':'){
				if(n == ':'){
					s.append('::');
					i++;
				} else {
					name = new java.lang.StringBuffer();
					inname = true;
					s.append('?');
				}
			} else {
				s.append(c);
			}
		} else {
			if(c == ':'){	// another symbol
				if(n == ':'){
					s.append('::');
					i++;
				} else {
					var k = name.toString();
					rargs.push(k in args ? args[k] : null);
					name = new java.lang.StringBuffer();
				}
			} else if(JsSymbols.indexOf(c) == -1){
				name.append(c);
			} else {
				s.append(c);
				var k = name.toString();
				rargs.push(k in args ? args[k] : null);
				inname = false;
				name = null;
			}
		}
	}
	if(inname && name != null){
		var k = name.toString();
		rargs.push(k in args ? args[k] : null);
	}
	return {sql : s.toString(), args : rargs};
}

DBJS.prototype.clone = function(){
	var obj = new DBJS(this.sqlExecutor);
	for(var k in this){
		if(this.hasOwnProperty(k)) obj[k] = this[k];
	}
	return obj;
};

/**
 * 执行事务。用法：
 * <pre class="code">
 * this.doTransaction(function(){
 * 		this.execute('insert ...');
 * 		this.execute('update ');
 * 		...
 * });
 * </pre>
 * action 中的操作将在一个事务中执行，全部成功后自动提交，中间出错则整体回滚。
 * @type DBJS
 * @param action function(){ ... }  事务执行内容 
 */
DBJS.prototype.doTransaction = function(action){
	var me = this.clone();
	var conn = me.transactConnection;
	if(conn){		// 正在进行事务
		action.call(me);
	} else {
		try {
			conn = me.transactConnection = me.sqlExecutor.beginTransaction();
			action.call(me)
			conn.commit();
			me.transactConnection = null;
		} catch (e) {
			try { conn.rollback(); } catch ( e1) { }
			throw e;
		} finally {
			if(conn != null) try{conn.close()} catch(e){}
		}
	}
	
};

/**
 * 关闭连接池所有连接结束工作, 适用于只用一次的场景，一般不会用到。
 */
DBJS.prototype.release = function(){
	this.sqlExecutor.release();
};

/**
 * 获取连接
 * @returns java.sql.Connection
 */
DBJS.prototype.getConnection = function(){
	return this.sqlExecutor.getConnection();
};

var dbjs = null;
var handler = null;

function init(sqlExecutor, client){	
	dbjs = handler = new DBJS(sqlExecutor);
	engine.put('handler', handler);
	engine.put('dbjs', dbjs);
	sqlExecutor.defaultJsonDbType = 'JSONB';
}


var ObjectArray = Java.type('java.lang.Object[]'), 
	ScriptObjectMirror = Java.type('jdk.nashorn.api.scripting.ScriptObjectMirror'),
	JsTypeUtil = Java.type('org.siphon.common.js.JsTypeUtil'),
	EngineUtil = Java.type('org.siphon.common.js.JsEngineUtil');

/**
 * 调用另一个 dbjs 文件的函数
 * @param src 
 * @param method 
 * @param params 数组 - 参数列表，单值 - 单个参数
 */
DBJS.prototype.callDbjs = function(src, method, params){
	var engineContext = dbjsRunner.getEngineContext(findResource(src), request, response);
	if(engineContext == null) throw new Error(src + ' maybe not exist');
	try{
		var another = engineContext.getHandler();	// ScriptObjectMirror
		if(this.transactConnection){
			another = engineContext.getEngineAsInvocable().invokeMethod(another, 'clone');	// ScriptObjectMirror
			another.transactConnection = this.transactConnection;
		}
		var engine2 = engineContext.getScriptEngine();
		var bindings = engine2.getBindings(100);
		bindings['__s'] = JSON.stringify(params instanceof Array ? params : [params]);		// 欲在两个引擎间传递对象，只能使用这种方法
		var res = engine2.eval("dbjs." + method + '.apply(dbjs, JSON.parse(__s, parseDate))', bindings);
		if(res != null && res instanceof ScriptObjectMirror) res = org.siphon.common.js.JsTypeUtil.getSealed(res);
		dbjsRunner.completeTask(engineContext.getScriptEngine(), null);
		return res;
	} catch(e){
		dbjsRunner.completeTask(engineContext.getScriptEngine(), new ECMAException(e, null));
		throw e;
	} finally {
		if (engineContext != null)
			engineContext.free();
	}
}

/**
 * 更新数据总入口
 * @param params {table : 待更新数据} 待更新数据定义为： {name : 'xxx', src : "xxx.dbjs", columns : [...], rows : [{fld: v, fld: v,..., _origin : {}, _state : 'none|edit|remove|new', _children : [嵌套子表，同本结构]}]}
 */
DBJS.prototype.update = function(params){
	this.updateTable(params.table, null, true);
}

DBJS.prototype.updateTable = function(table, parentRow, isSelf){
	var path = request.getServletContext().getContextPath();
	var src = table.src.replace(path, '');
	src = request.getServletContext().getRealPath(src);
	this.doTransaction(function(){
		for(var i=0;i<table.rows.length; i++){
			var row = table.rows[i];
			try{
				switch(row._state){
				case 'new' : 
					if(isSelf){
						this.create(row, table.columns);
					} else {
						this.callDbjs(src, 'create', [row, table.columns]);
					}
					row._children && updateChildren.call(this, row);
					break;
				case 'edit' :
					row._children && updateChildren.call(this, row);
					if(isSelf){
						this.modify(row, table.columns);
					} else {
						this.callDbjs(src, 'modify', [row, table.columns]);
					}
					break;
				case 'remove' : 
					row._children && updateChildren.call(this, row);
					if(isSelf){
						this.destroy(row, table.columns);
					} else {
						this.callDbjs(src, 'destroy', [row, table.columns]);
					}
					break;
				case 'none' :
					row._children && updateChildren.call(this, row);
					break;
				}
			} catch(e){
				var err = e;
				if(e instanceof Throwable){
					var err = org.siphon.common.js.JsEngineUtil.parseJsException(e);
				}
				err.table = table.name;
				err.idx = row._idx;
				throw e;
			}
		}
	});
	
	function updateChildren(row){
		for(var i=0;i<row._children.length; i++){
			this.updateTable(row._children[i], row);
		}
	}
}

