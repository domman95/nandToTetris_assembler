/*
  TODO: Assembler which read .asm, compute them and write .hack

  1. Get the .asm file and read them
  2. Delete all comments, whitespace, ...
  3. Find code line startsWith '@', it means that it is a A-Instruction
      - compute value from decimal to binary
      - compute binary value into 16-bits
  4. Find code line which looks like C-Instruction (D=A, D=D+A, M=D, ...)
  5. Compute them using table of comp, dest and jump binary
  6. Write (or display in console) result of converted code

*/

const myArgs = process.argv.slice(2);
const readline = require('readline');
const fs = require('fs');
let labelCount = 0;

let i = 16;

compTable = {
	0: {
		// a = 0
		0: '101010',
		1: '111111',
		'-1': '111010',
		D: '001100',
		A: '110000',
		'!D': '001101',
		'!A': '110001',
		'-D': '001111',
		'-A': '110011',
		'D+1': '011111',
		'A+1': '110111',
		'D-1': '001110',
		'A-1': '110010',
		'D+A': '000010',
		'D-A': '010011',
		'A-D': '000111',
		'D&A': '000000',
		'D|A': '010101',
	},
	1: {
		// a = 1
		M: '110000',
		'!M': '110001',
		'-M': '110011',
		'M+1': '110111',
		'M-1': '110010',
		'D+M': '000010',
		'D-M': '010011',
		'M-D': '000111',
		'D&M': '000000',
		'D|M': '010101',
	},
};

destTable = {
	null: '000',
	M: '001',
	D: '010',
	MD: '011',
	A: '100',
	AM: '101',
	AD: '110',
	AMD: '111',
};

jumpTable = {
	null: '000',
	JGT: '001',
	JEQ: '010',
	JGE: '011',
	JLT: '100',
	JNE: '101',
	JLE: '110',
	JMP: '111',
};

const line_counter = (
	(i = 0) =>
	() =>
		++i
)();

function compute16Binary(line) {
	line = +line;
	line = line.toString(2);
	while (line.length < 16) {
		line = '0' + line;
	}
	return line;
}

const labels = {};

function CheckCodeForLabels(fileName) {
	const rl = readline.createInterface({
		input: fs.createReadStream(fileName),
	});

	rl.on('line', line => {
		line = line.replace(/\s+/g, '');
		if (line.indexOf('/') > -1) {
			line = line.substr(0, line.indexOf('/'));
		}

		if (line.length > 0) {
			findLabels(line);
		}
	});

	rl.on('close', () => {
		Assembler(fileName);
	});

	function findLabels(line) {
		lineno = line_counter();

		if (/^\(([A-Z]|[_]|[.]|[$]|[0-9]*)+\)$/gi.test(line)) {
			// find (LABEL_NAME)
			labelCount += 1;
			line = line.substr(1, line.length - 2);
			labels[line] = lineno - labelCount;
		}

		if (/^@(_|[a-z])([a-z]|_)+/g.test(line)) {
			// find any @lower_case_var
			line = line.substr(1);
			if (!labels[line]) {
				labels[line] = i;
				i++;
			}
		}

		if (line.startsWith('@')) {
			line = line.substr(1);
			if (line.startsWith('R')) {
				line = line.substr(1);
				labels[`R${line}`] = +line;
			}
			switch (line) {
				case 'SCREEN':
					labels[line] = 16384;
					return;
				case 'KBD':
					labels[line] = 24576;
					return;
				case 'SP':
					labels[line] = 0;
					return;
				case 'LCL':
					labels[line] = 1;
					return;
				case 'ARG':
					labels[line] = 2;
					return;
				case 'THIS':
					labels[line] = 3;
					return;
				case 'THAT':
					labels[line] = 4;
					return;
				default:
					return;
			}
		}
	}
}

function Assembler(fileName) {
	const result = [];

	const rl = readline.createInterface({
		input: fs.createReadStream(fileName),
	});

	rl.on('line', line => {
		line = line.replace(/\s+/g, '');
		if (line.indexOf('/') > -1) {
			line = line.substr(0, line.indexOf('/'));
		}

		if (line.length > 0) {
			computingLines(line);
		}
	});

	rl.on('close', () => {
		writeAssembly(result);
	});

	function computingLines(line) {
		if (line.startsWith('@')) {
			line = line.substr(1);
			line = labels.hasOwnProperty(line) ? labels[line] : line;

			line = compute16Binary(line);
			result.push(line);
		} else {
			let dest;
			let comp;
			let jump;
			if (line.includes('=') && line.includes(';')) {
				dest = line.substr(0, line.indexOf('='));
				comp = line.substr(
					line.indexOf('=') + 1,
					line.indexOf(';') - 2,
				);
				jump = line.substr(line.indexOf(';') + 1);
			} else if (line.includes('=') && !line.includes(';')) {
				dest = line.substr(0, line.indexOf('='));
				comp = line.substr(line.indexOf('=') + 1);
				jump = 'null';
			} else if (!line.includes('=') && line.includes(';')) {
				dest = 'null';
				comp = line.substr(0, line.indexOf(';'));
				jump = line.substr(line.indexOf(';') + 1);
			}
			if (!/^\(([A-Z]|[_]|[.]|[$]|[0-9]*)+\)$/gi.test(line)) {
				computeInstructionC(dest, comp, jump);
			}
		}
	}

	function computeInstructionC(dest, comp, jump) {
		let binaryString = '111';
		let a;

		if (compTable[0][comp]) {
			a = 0;
		} else {
			a = 1;
		}

		binaryString += a + compTable[a][comp];

		binaryString += destTable[dest] + jumpTable[jump];

		result.push(binaryString);
	}

	function writeAssembly(array) {
		const outputFileName =
			fileName.substr(0, fileName.indexOf('.')) + '.hack';
		const outputFileName_ = outputFileName.substr(
			outputFileName.indexOf('/') + 1,
		);
		const outputFile = array.join('\n');

		fs.mkdir('output', {recursive: true}, err => {
			if (err) throw err;
		});
		fs.writeFile(
			`${__dirname}/output/${outputFileName_}`,
			outputFile,
			err => {
				if (err) throw err;
			},
		);
	}
}

CheckCodeForLabels(myArgs[0]);
