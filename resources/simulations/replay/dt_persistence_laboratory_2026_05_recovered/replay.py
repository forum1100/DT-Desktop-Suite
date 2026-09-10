import ast, pathlib, contextlib, io, json
HERE=pathlib.Path(__file__).resolve().parent
source=(HERE/'run_01.py').read_text(encoding='utf-8')
tree=ast.parse(source,filename='run_01.py')
last=None
if tree.body and isinstance(tree.body[-1],ast.Expr):
    last=tree.body.pop().value
ns={'__name__':'__main__','__file__':str(HERE/'run_01.py')}
stdout=io.StringIO()
with contextlib.redirect_stdout(stdout):
    exec(compile(tree,'run_01.py','exec'),ns,ns)
    value=eval(compile(ast.Expression(last),'run_01.py','eval'),ns,ns) if last is not None else None
receipt={'returncode':0,'stdout':stdout.getvalue(),'final_expression_repr':repr(value)}
(HERE/'replay_receipt.json').write_text(json.dumps(receipt,indent=2),encoding='utf-8')
print(repr(value))